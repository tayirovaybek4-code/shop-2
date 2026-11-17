from html.parser import HTMLParser
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.contrib.auth import SESSION_KEY, get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import reverse


GOOGLE_PROVIDER = {
    "google": {
        "APP": {"client_id": "test-client-id", "secret": "test-client-secret"},
        "SCOPE": ["profile", "email"],
        "OAUTH_PKCE_ENABLED": True,
    }
}


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.stack = []
        self.has_nested_forms = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form":
            self.has_nested_forms |= bool(self.stack)
            form = {"attrs": attrs, "fields": [], "buttons": []}
            self.forms.append(form)
            self.stack.append(form)
        elif self.stack and tag in {"input", "button"}:
            self.stack[-1]["buttons" if tag == "button" else "fields"].append(attrs)

    def handle_endtag(self, tag):
        if tag == "form" and self.stack:
            self.stack.pop()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    ACCOUNT_EMAIL_VERIFICATION="none",
    ACCOUNT_RATE_LIMITS={},
    SOCIALACCOUNT_PROVIDERS={"google": {}},
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class AuthenticationTests(TestCase):
    password = "ValidShoppingPassword-83!"

    def setUp(self):
        cache.clear()

    def signup_data(self, **changes):
        data = {
            "name": "Ali Valiyev",
            "email": "ali@example.com",
            "password1": self.password,
            "password2": self.password,
            "terms": "on",
        }
        data.update(changes)
        return data

    def create_user(self):
        user = get_user_model().objects.create_user(
            username="buyer", email="buyer@example.com", password=self.password
        )
        EmailAddress.objects.create(
            user=user, email=user.email, primary=True, verified=True
        )
        return user

    def assert_independent_google_form(self, response):
        parser = FormParser()
        parser.feed(response.content.decode())
        self.assertFalse(parser.has_nested_forms)
        forms = [
            form for form in parser.forms
            if urlsplit(form["attrs"].get("action", "")).path == reverse("google_login")
        ]
        self.assertEqual(len(forms), 1)
        form = forms[0]
        self.assertEqual(form["attrs"].get("method", "").lower(), "post")
        self.assertNotEqual(form["attrs"].get("data-demo"), "true")
        fields = {field.get("name") for field in form["fields"]}
        self.assertIn("csrfmiddlewaretoken", fields)
        self.assertFalse(fields & {"name", "email", "login", "password", "password1", "password2", "terms"})
        self.assertTrue(form["buttons"])
        self.assertTrue(all("disabled" not in button for button in form["buttons"]))

    def test_auth_pages_render_without_google_credentials(self):
        for name, template in (
            ("login", "login.html"),
            ("register", "register.html"),
            ("account_login", "login.html"),
            ("account_signup", "register.html"),
        ):
            with self.subTest(page=name):
                response = self.client.get(reverse(name))
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, template)
                self.assertFalse(response.context["google_login_available"])
                self.assertContains(response, "Continue with Google")
                self.assert_independent_google_form(response)

    def test_signup_creates_user_and_authenticated_session(self):
        response = self.client.post(reverse("register"), self.signup_data(), follow=True)

        self.assertRedirects(response, settings.LOGIN_REDIRECT_URL, fetch_redirect_response=False)
        self.assertContains(response, "Ali Valiyev")
        self.assertContains(response, reverse("logout"))
        user = get_user_model().objects.get(email="ali@example.com")
        self.assertEqual(user.first_name, "Ali")
        self.assertEqual(user.last_name, "Valiyev")
        self.assertNotEqual(user.password, self.password)
        self.assertTrue(user.check_password(self.password))
        self.assertEqual(self.client.session[SESSION_KEY], str(user.pk))
        self.assertTrue(
            EmailAddress.objects.filter(user=user, email=user.email, primary=True).exists()
        )

    def test_signup_rejects_invalid_passwords_and_missing_consent(self):
        cases = (
            ({"password2": "DifferentPassword-84!"}, "password2"),
            ({"password1": "12345678", "password2": "12345678"}, "password1"),
            ({"terms": ""}, "terms"),
            ({"name": ""}, "name"),
        )
        for changes, field in cases:
            with self.subTest(field=field, changes=changes):
                response = self.client.post(reverse("register"), self.signup_data(**changes))
                self.assertEqual(response.status_code, 200)
                self.assertIn(field, response.context["form"].errors)
                self.assertContains(response, "ali@example.com")
                self.assertNotIn(self.password, response.content.decode())
                self.assertFalse(get_user_model().objects.exists())

    def test_signup_does_not_create_duplicate_email_account(self):
        self.create_user()
        self.client.post(
            reverse("register"), self.signup_data(email="BUYER@example.com")
        )
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_email_login_is_case_insensitive_and_preserves_local_next(self):
        user = self.create_user()
        response = self.client.post(
            reverse("login"),
            {"login": "BUYER@EXAMPLE.COM", "password": self.password, "next": "/account/"},
        )

        self.assertRedirects(response, "/account/", fetch_redirect_response=False)
        self.assertEqual(self.client.session[SESSION_KEY], str(user.pk))

    def test_incorrect_password_does_not_authenticate(self):
        self.create_user()
        response = self.client.post(
            reverse("login"), {"login": "buyer@example.com", "password": "wrong"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["form"].errors)
        self.assertContains(response, "buyer@example.com")
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_login_rejects_external_next_redirect(self):
        self.create_user()
        response = self.client.post(
            reverse("login"),
            {
                "login": "buyer@example.com",
                "password": self.password,
                "next": "https://untrusted.example/account/",
            },
        )
        self.assertRedirects(response, settings.LOGIN_REDIRECT_URL, fetch_redirect_response=False)

    def test_remember_me_controls_session_expiration(self):
        self.create_user()
        for remember in ("", "on"):
            with self.subTest(remember=remember):
                client = Client()
                response = client.post(
                    reverse("login"),
                    {
                        "login": "buyer@example.com",
                        "password": self.password,
                        "remember": remember,
                    },
                )
                self.assertEqual(response.status_code, 302)
                self.assertEqual(client.session.get_expire_at_browser_close(), not remember)

    def test_logout_post_ends_session(self):
        user = self.create_user()
        self.client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")

        response = self.client.post(reverse("logout"))

        self.assertRedirects(response, settings.LOGOUT_REDIRECT_URL, fetch_redirect_response=False)
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_login_and_signup_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        for name in ("login", "register"):
            with self.subTest(page=name):
                response = client.post(reverse(name), self.signup_data())
                self.assertEqual(response.status_code, 403)
        self.assertFalse(get_user_model().objects.exists())

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_configured_google_button_uses_independent_post_form(self):
        for name in ("login", "register"):
            with self.subTest(page=name):
                response = self.client.get(reverse(name))
                self.assertTrue(response.context["google_login_available"])
                self.assertContains(response, reverse("google_login"))
                self.assert_independent_google_form(response)

    def test_google_post_reports_missing_or_empty_configuration(self):
        for provider in (
            {"google": {}},
            {"google": {"APP": {"client_id": "", "secret": ""}}},
        ):
            with self.subTest(provider=provider), self.settings(SOCIALACCOUNT_PROVIDERS=provider):
                response = self.client.post(reverse("google_login"))
                self.assertEqual(response.status_code, 503)
                self.assertTemplateUsed(response, "socialaccount/authentication_error.html")
                self.assertContains(response, "Google", status_code=503)
                self.assertContains(response, reverse("login"), status_code=503)
                self.assertNotIn(SESSION_KEY, self.client.session)
        self.assertFalse(get_user_model().objects.exists())

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_duplicate_google_post_reports_configuration_error(self):
        SocialApp.objects.create(
            provider="google", name="Duplicate", client_id="database-client", secret="database-secret"
        )
        response = self.client.post(reverse("google_login"))
        self.assertEqual(response.status_code, 503)
        self.assertTemplateUsed(response, "socialaccount/authentication_error.html")
        self.assertNotIn(SESSION_KEY, self.client.session)

    def test_database_google_app_is_available(self):
        SocialApp.objects.create(
            provider="google", name="Google", client_id="database-client", secret="database-secret"
        )
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["google_login_available"])
        self.assertContains(response, reverse("google_login"))

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_duplicate_google_apps_do_not_crash_auth_page(self):
        SocialApp.objects.create(
            provider="google", name="Duplicate", client_id="database-client", secret="database-secret"
        )
        for name in ("login", "register"):
            with self.subTest(page=name):
                response = self.client.get(reverse(name))
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.context["google_login_available"])

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_google_oauth_redirect_contains_callback_scope_state_and_pkce(self):
        response = self.client.post(reverse("google_login"), {"next": "/account/"})

        self.assertEqual(response.status_code, 302)
        destination = urlsplit(response.url)
        self.assertEqual(destination.hostname, "accounts.google.com")
        parameters = parse_qs(destination.query)
        self.assertEqual(parameters["client_id"], ["test-client-id"])
        self.assertEqual(
            parameters["redirect_uri"],
            ["http://testserver" + reverse("google_callback")],
        )
        self.assertTrue({"email", "profile"}.issubset(parameters["scope"][0].split()))
        self.assertTrue(parameters["state"][0])
        self.assertEqual(parameters["code_challenge_method"], ["S256"])
        self.assertTrue(parameters["code_challenge"][0])

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_google_login_requires_csrf(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post(reverse("google_login"))
        self.assertEqual(response.status_code, 403)

        client.get(reverse("login"))
        response = client.post(
            reverse("google_login"),
            {"csrfmiddlewaretoken": client.cookies["csrftoken"].value},
        )
        self.assertEqual(response.status_code, 302)

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_google_cancelled_callback_does_not_authenticate(self):
        start = self.client.post(reverse("google_login"))
        state = parse_qs(urlsplit(start.url).query)["state"][0]

        response = self.client.get(
            reverse("google_callback"), {"state": state, "error": "access_denied"}
        )

        self.assertRedirects(response, reverse("socialaccount_login_cancelled"))
        self.assertNotIn(SESSION_KEY, self.client.session)
        self.assertFalse(get_user_model().objects.exists())

    @override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER)
    def test_google_callback_creates_account_and_session(self):
        start = self.client.post(reverse("google_login"), {"next": "/account/"})
        state = parse_qs(urlsplit(start.url).query)["state"][0]
        adapter = "allauth.socialaccount.providers.google.views.GoogleOAuth2Adapter"
        with (
            patch(adapter + ".get_access_token_data", return_value={"access_token": "test-token"}),
            patch(
                adapter + "._fetch_user_info",
                return_value={
                    "id": "google-test-user",
                    "email": "google-buyer@example.com",
                    "verified_email": True,
                    "given_name": "Google",
                    "family_name": "Buyer",
                    "name": "Google Buyer",
                },
            ),
        ):
            response = self.client.get(
                reverse("google_callback"), {"state": state, "code": "test-code"}
            )

        self.assertRedirects(response, "/account/", fetch_redirect_response=False)
        user = get_user_model().objects.get(email="google-buyer@example.com")
        self.assertFalse(user.has_usable_password())
        self.assertEqual(self.client.session[SESSION_KEY], str(user.pk))
        self.assertTrue(
            SocialAccount.objects.filter(user=user, provider="google", uid="google-test-user").exists()
        )
