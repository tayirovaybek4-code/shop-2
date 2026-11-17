from allauth.socialaccount.models import SocialAccount

from .authentication import get_google_app


def authentication(request):
    """Keep auth pages usable before Google credentials have been configured."""
    match = request.resolver_match
    if not match or match.url_name not in {
        "login", "register", "account_login", "account_signup"
    }:
        return {}

    return {"google_login_available": get_google_app(request) is not None}


def profile(request):
    avatar_url = ""
    if request.user.is_authenticated:
        google_profile = (
            SocialAccount.objects.filter(user=request.user, provider="google")
            .order_by("-last_login")
            .values_list("extra_data", flat=True)
            .first()
        )
        if google_profile:
            picture = google_profile.get("picture")
            if isinstance(picture, str) and picture.startswith("https://"):
                avatar_url = picture
    return {"profile_avatar_url": avatar_url}
