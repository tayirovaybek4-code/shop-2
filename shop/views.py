from allauth.socialaccount.providers.google.views import oauth2_login
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .authentication import get_google_app


@require_POST
def google_login(request):
    if get_google_app(request) is None:
        return render(
            request,
            "socialaccount/authentication_error.html",
            status=503,
        )
    return oauth2_login(request)


def home(request):
    return render(request, "index.html")


def shop(request):
    return render(request, "shop.html")


def wishlist(request):
    return render(request, "wishlist.html")


def order_success(request):
    return render(request, "order-success.html")


def product(request):
    return render(request, "product.html")


def dashboard(request):
    return render(request, "dashboard.html")


def contact(request):
    return render(request, "contact.html")


def checkout(request):
    return render(request, "checkout.html")


def cart(request):
    return render(request, "cart.html")


def blog(request):
    return render(request, "blog.html")


def article(request):
    return render(request, "article.html")


def account(request):
    return render(request, "account.html")


def about(request):
    return render(request, "about.html")
