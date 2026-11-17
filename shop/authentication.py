from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.models import SocialApp
from django.core.exceptions import MultipleObjectsReturned


def get_google_app(request):
    """Return a usable Google app from settings or Django admin."""
    try:
        app = get_adapter(request).get_app(request, provider="google")
    except (SocialApp.DoesNotExist, MultipleObjectsReturned):
        return None
    return app if app.client_id and app.secret else None
