from django.contrib import admin

from .models import Category, Order, OrderItem, Product, ProductImage


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "sku",
        "category",
        "price",
        "sale_price",
        "stock",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "category")
    search_fields = ("name", "sku", "description")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (ProductImageInline,)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "sku", "unit_price", "quantity")
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "customer_name",
        "email",
        "status",
        "payment_method",
        "payment_status",
        "total",
        "created_at",
    )
    list_filter = ("status", "payment_method", "payment_status", "created_at")
    search_fields = ("reference", "customer_name", "email", "phone")
    readonly_fields = ("reference", "created_at", "updated_at")
    inlines = (OrderItemInline,)
