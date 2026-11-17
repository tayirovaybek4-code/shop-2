# PHLOX shop — Django frontend

## Ishga tushirish
    .\venv\Scripts\python.exe -m pip install -r requirements.txt
    .\venv\Scripts\python.exe manage.py migrate
    .\venv\Scripts\python.exe manage.py runserver

## Login va ro'yxatdan o'tish

- `/register/` ism, email, parol va parol tasdig'i orqali haqiqiy hisob yaratadi.
- `/login/` email va parol bilan kiradi; muvaffaqiyatli kirishdan keyin `/account/` ochiladi.
- `/logout/` POST so'rovi orqali sessiyani tugatadi; tugma account sahifasida bor.
- `/accounts/` ostida allauth URL'lari, parolni tiklash va Google callback ishlaydi.
- Lokal muhitda emailni tasdiqlash talab qilinmaydi. Parolni tiklash xati terminalga
  chiqadi (`console.EmailBackend`); haqiqiy email yuborish uchun email backend va
  uning server sozlamalarini alohida kiriting.

## Google orqali kirish

1. `.env.example` faylidan `.env` nusxa yarating va Google Cloud'dagi OAuth
   **Web application** uchun `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` ni kiriting.
   `.env` faylini ulashmang yoki repozitoriyga qo'shmang.
2. Google Cloud OAuth client sozlamalarida **Authorized redirect URIs** ga ishlatayotgan
   manzilingizni kiriting:

       http://127.0.0.1:8000/accounts/google/login/callback/
       http://localhost:8000/accounts/google/login/callback/

   Brauzerdagi host, port, protokol va oxirgi `/` shu manzilga mos bo'lishi kerak.
   OAuth ilovasi Testing rejimida bo'lsa, Google hisobingizni Test users ro'yxatiga qo'shing.
3. Django serverini qayta ishga tushiring. Login va register sahifalaridagi Google
   tugmasi CSRF bilan himoyalangan alohida POST forma orqali ishlaydi.

Muqobil usul: Django admin orqali bitta Google **Social application** yarating.
Bir xil provider uchun `.env` va admin orqali ikki marta sozlamang.
Google tugmasi login va register sahifalarida doim ko'rinadi. Kalitlar bo'lmasa,
tugma bosilganda tushunarli xabar chiqadi; email/parol bilan kirish ishlayveradi.

[Rasmiy Google allauth qo'llanmasi](https://docs.allauth.org/en/latest/socialaccount/providers/google.html)

## Tekshirish

    .\venv\Scripts\python.exe manage.py check
    .\venv\Scripts\python.exe manage.py test shop

## Tuzilma
- templates/base.html — umumiy shablon (navbar, footer, savat paneli, qidiruv). Hamma sahifa shundan meros oladi.
- templates/partials/_product_card.html — BITTA mahsulot kartochkasi (hamma joyda ishlatiladi).
- templates/partials/_demo_products.html — demo mahsulotlar. View `products` bersa, ko'rinmaydi.
- static/assets/css/style.css — yangi dizayn. static/assets/js/app.js — savat, wishlist, filtr, animatsiyalar.

## Django'ga ulash (keyinroq)
1. View'dan `products` (shop, home), `product` (product), `orders` (account) yuboring.
   Kartochka maydonlari: id, name, price, image.url, category, stock.
2. Mahsulot havolasi faqat `_product_card.html` ichida (`{% url 'product' %}?id=`) — urls.py o'zgarsa, shu yerni o'zgartiring.
3. `contact`, `checkout` va `newsletter` formalari hali `data-demo="true"` bilan ishlaydi.
   Login va register formalari allauth backend'iga ulangan.
4. Product sahifada ham `data-demo="true"` ni o'chiring va `{{ product.* }}` qiymatlarini ishlating.
5. Dashboard: dashboard.html oxirida `demo: true` -> haqiqiy API tayyor bo'lganda `false`.
6. Savat/wishlist hozir brauzer localStorage'da (mehmonlar uchun). Keyin serverga ulash mumkin.
7. Qo'shimcha sahifalar (faq, privacy, terms, logout): ADD_THESE_URLS_VIEWS.txt.

## Maxfiy sozlamalar

- Lokal sozlash uchun .env.example faylidan .env nusxa yarating. .env faylini GitHub ga yuklamang.
- Ishlab turgan serverda DJANGO_DEBUG=False, alohida yaratilgan DJANGO_SECRET_KEY va haqiqiy domenlarni DJANGO_ALLOWED_HOSTS ga kiriting.
- DJANGO_SECRET_KEY ni yaratish uchun Django utilitasidan foydalaning: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())".
