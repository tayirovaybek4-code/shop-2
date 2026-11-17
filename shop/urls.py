from django.urls import path
from allauth.account.views import LoginView, LogoutView, SignupView
from . import views

urlpatterns=[
    path('', views.home, name="home"),
    path('shop/', views.shop, name="shop"),
    path('wishlist/', views.wishlist, name="wishlist"),
    path('register/', SignupView.as_view(template_name="register.html"), name="register"),
    path('order-success/', views.order_success, name="order-success"),
    path('product/', views.product, name="product"),
    path('login/', LoginView.as_view(template_name="login.html"), name="login"),
    path('logout/', LogoutView.as_view(), name="logout"),
    path('dashboard/', views.dashboard, name="dashboard"),
    path('contact/', views.contact, name="contact"),
    path('checkout/', views.checkout, name="checkout"),
    path('cart/', views.cart, name="cart"),
    path('blog/', views.blog, name="blog"),
    path('article/', views.article, name="article"),
    path('account/', views.account, name="account"),
    path('about/', views.about, name="about"),
]
