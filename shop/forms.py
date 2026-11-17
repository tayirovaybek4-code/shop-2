from allauth.account.forms import SignupForm as AllauthSignupForm
from django import forms


class SignupForm(AllauthSignupForm):
    name = forms.CharField(label="Full name", max_length=150)
    terms = forms.BooleanField(
        label="I agree to the Terms and Privacy Policy.",
        error_messages={"required": "Please accept the Terms and Privacy Policy."},
    )

    def save(self, request):
        user = super().save(request)
        names = self.cleaned_data["name"].split(maxsplit=1)
        user.first_name = names[0]
        user.last_name = names[1] if len(names) > 1 else ""
        user.save(update_fields=["first_name", "last_name"])
        return user
