// ============================================================
// language.js – Showly Çok Dilli Destek Modülü
// Desteklenen diller: tm (Türkmen), ru (Rusça), en (İngilizce)
// ============================================================

(function () {
    'use strict';

    // --- AYARLAR ---
    const LANG_STORAGE_KEY = 'showly_language';
    const DEFAULT_LANG = 'tm';
    const SUPPORTED_LANGS = ['tm', 'ru', 'en'];

    // --- ÇEVİRİ TABLOSU ---
    const TRANSLATIONS = {
        // Header & Search
        search_placeholder: {
            tm: 'Gözle...',
            ru: 'Поиск...',
            en: 'Search...'
        },

        // Hero Section
        hero_title: {
            tm: 'Ähli görnüşli satyjylar üçin online kataloglar',
            ru: 'Онлайн-каталоги для продавцов всех видов',
            en: 'Online catalogs for all types of sellers'
        },
        hero_subtitle: {
            tm: 'Bir sahypada ähli önümleriniz – müşderiler üçin taýýar görnüşde.',
            ru: 'Все ваши товары на одной странице — в готовом виде для клиентов.',
            en: 'All your products on one page — ready for customers.'
        },

        // Info Section
        about_title: {
            tm: 'Biz barada',
            ru: 'О нас',
            en: 'About Us'
        },
        about_text_1: {
            tm: 'Şowly – Türkmenistanda döredilen onlaýn katalog platformasy.',
            ru: 'Şowly — онлайн-платформа каталогов, созданная в Туркменистане.',
            en: 'Showly — an online catalog platform created in Turkmenistan.'
        },
        about_text_2: {
            tm: 'Biz satyjylaryň önümlerini müşderilere ýakynlaşdyrýarys.',
            ru: 'Мы приближаем товары продавцов к покупателям.',
            en: 'We bring sellers\' products closer to customers.'
        },
        about_text_3: {
            tm: 'Maksadymyz – her bir satyjynyň online çykmagyny ýeňilleşdirmek.',
            ru: 'Наша цель — облегчить выход каждого продавца в онлайн.',
            en: 'Our goal — to make it easy for every seller to go online.'
        },
        why_title: {
            tm: 'Näme üçin Şowly ?',
            ru: 'Почему Şowly?',
            en: 'Why Showly?'
        },
        feature_easy: {
            tm: 'Ýönekeý ulanyş',
            ru: 'Простое использование',
            en: 'Easy to use'
        },
        feature_fast: {
            tm: 'Çalt wagtda satyjy bolmak hyzmaty',
            ru: 'Быстрая услуга стать продавцом',
            en: 'Quick seller registration service'
        },

        // Product Cards & Lists
        add_to_cart: {
            tm: 'Sebede goş',
            ru: 'В корзину',
            en: 'Add to Cart'
        },
        discount: {
            tm: 'Arzanladyş',
            ru: 'Скидка',
            en: 'Sale'
        },

        // Cart Modal
        cart_title: {
            tm: 'Sebedim',
            ru: 'Корзина',
            en: 'My Cart'
        },
        cart_empty: {
            tm: 'Siz öz sargyt etjek harytlaryňyzy şu sebede goşup bilersiňiz.',
            ru: 'Вы можете добавить товары для заказа в эту корзину.',
            en: 'You can add products to your cart for ordering.'
        },
        cart_total: {
            tm: 'Umumy',
            ru: 'Итого',
            en: 'Total'
        },
        order_btn: {
            tm: 'Sargyt et',
            ru: 'Заказать',
            en: 'Order'
        },
        delivery_notice: {
            tm: 'Aşgabada we başga 5 welaýata sargyt edip berýäris.',
            ru: 'Доставляем заказы в Ашхабад и 5 велаятов.',
            en: 'We deliver orders to Ashgabat and 5 regions.'
        },

        // Favorites Modal
        favorites_title: {
            tm: 'Halanlarym',
            ru: 'Избранное',
            en: 'Favorites'
        },
        favorites_empty: {
            tm: 'Siz harytlardan öz halanyňyzy saýlap bilersiňiz.',
            ru: 'Вы можете выбрать понравившиеся товары.',
            en: 'You can select your favorite products.'
        },

        // Product Modal
        material_label: {
            tm: 'Material:',
            ru: 'Материал:',
            en: 'Material:'
        },

        // Search Results
        search_results: {
            tm: 'Gözleg',
            ru: 'Поиск',
            en: 'Search'
        },
        search_count: {
            tm: 'harydy',
            ru: 'товаров',
            en: 'products'
        },
        no_results: {
            tm: 'Haryt tapylmady',
            ru: 'Товар не найден',
            en: 'No products found'
        },
        search_empty_warning: {
            tm: 'Gözleýän harydyňyzyň adyny ýazyň!',
            ru: 'Введите название товара!',
            en: 'Enter a product name!'
        },

        // Filters
        filter_btn: {
            tm: 'Filtr',
            ru: 'Фильтр',
            en: 'Filter'
        },
        filter_all: {
            tm: 'Ähli harytlar',
            ru: 'Все товары',
            en: 'All Products'
        },
        filter_discount: {
            tm: 'Arzanladyş',
            ru: 'Со скидкой',
            en: 'On Sale'
        },
        filter_price_asc: {
            tm: 'Arzandan gymmada',
            ru: 'От дешёвых к дорогим',
            en: 'Price: Low to High'
        },
        filter_price_desc: {
            tm: 'Gymmatdan arzana',
            ru: 'От дорогих к дешёвым',
            en: 'Price: High to Low'
        },
        filter_quick: {
            tm: 'Hızlı Filtreler',
            ru: 'Быстрые фильтры',
            en: 'Quick Filters'
        },
        filter_price_range: {
            tm: 'Baha aralygy',
            ru: 'Ценовой диапазон',
            en: 'Price Range'
        },
        filter_no_product: {
            tm: 'Bu filtrde haryt tapylmady.',
            ru: 'По этому фильтру товаров не найдено.',
            en: 'No products found for this filter.'
        },

        // Loading
        loading: {
            tm: 'Biraz garaşyň...',
            ru: 'Подождите...',
            en: 'Please wait...'
        },

        // 404 Page
        not_found_title: {
            tm: 'Sahypa Tapylmady',
            ru: 'Страница не найдена',
            en: 'Page Not Found'
        },
        not_found_message: {
            tm: 'Gözleýän magazynyňyz tapylmady',
            ru: 'Магазин, который вы ищете, не найден',
            en: 'The store you are looking for was not found'
        },
        back_home: {
            tm: 'Esasy sahypa git',
            ru: 'На главную',
            en: 'Go to Home'
        },
        reload_page: {
            tm: 'Sahypany täzele',
            ru: 'Обновить страницу',
            en: 'Reload Page'
        },

        // Notifications
        added_to_cart: {
            tm: 'sebede goşuldy!',
            ru: 'добавлен в корзину!',
            en: 'added to cart!'
        },
        removed_from_favorites: {
            tm: 'Halanlarymdan aýryldy',
            ru: 'Удалено из избранного',
            en: 'Removed from favorites'
        },
        added_to_favorites: {
            tm: 'Halanlaryma goşuldy',
            ru: 'Добавлено в избранное',
            en: 'Added to favorites'
        },
        cart_is_empty: {
            tm: 'Sebediňiz boş!',
            ru: 'Корзина пуста!',
            en: 'Your cart is empty!'
        },

        // Order Form
        order_form_name: {
            tm: 'Adyňyz Familiýaňyz',
            ru: 'Имя и Фамилия',
            en: 'Full Name'
        },
        order_form_name_placeholder: {
            tm: 'Adyňyzy we Familiýaňyzy ýazyň',
            ru: 'Введите имя и фамилию',
            en: 'Enter your full name'
        },
        order_form_phone: {
            tm: 'Telefon nomeriňiz',
            ru: 'Ваш номер телефона',
            en: 'Your phone number'
        },
        order_form_address: {
            tm: 'Adresiňiz',
            ru: 'Ваш адрес',
            en: 'Your address'
        },
        order_form_address_placeholder: {
            tm: 'Adresiňizi ýazyň',
            ru: 'Введите ваш адрес',
            en: 'Enter your address'
        },
        order_form_note: {
            tm: 'Bellik (Opsiýonel)',
            ru: 'Примечание (необязательно)',
            en: 'Note (Optional)'
        },
        order_form_note_placeholder: {
            tm: 'Bellik',
            ru: 'Примечание',
            en: 'Note'
        },
        order_form_cancel: {
            tm: 'Aýyr',
            ru: 'Отмена',
            en: 'Cancel'
        },
        order_form_submit: {
            tm: 'Sargyt ediň',
            ru: 'Оформить заказ',
            en: 'Place Order'
        },
        order_items_label: {
            tm: 'Harytlar:',
            ru: 'Товары:',
            en: 'Products:'
        },
        order_processing: {
            tm: 'Sargydyňyz işlenýär...',
            ru: 'Ваш заказ обрабатывается...',
            en: 'Your order is being processed...'
        },
        order_fill_all: {
            tm: 'Ähli meýdançalary dolduryň!',
            ru: 'Заполните все поля!',
            en: 'Fill in all fields!'
        },
        order_phone_invalid: {
            tm: 'Telefon nomeriňizi dogry giriziň (+993 6XXXXXXX)!',
            ru: 'Введите правильный номер телефона (+993 6XXXXXXX)!',
            en: 'Enter a valid phone number (+993 6XXXXXXX)!'
        },

        // Banquet
        banquet_btn: {
            tm: 'Banket',
            ru: 'Банкет',
            en: 'Banquet'
        }
    };

    // --- CALLBACK SİSTEMİ ---
    const _langChangeCallbacks = [];

    // --- FONKSİYONLAR ---

    /** Aktif dili localStorage'dan oku */
    function getSelectedLang() {
        const lang = localStorage.getItem(LANG_STORAGE_KEY);
        return (lang && SUPPORTED_LANGS.includes(lang)) ? lang : DEFAULT_LANG;
    }

    /** Dili localStorage'a yaz ve callback'leri çalıştır */
    function setSelectedLang(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        localStorage.setItem(LANG_STORAGE_KEY, lang);

        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
        });

        // Dropdown'ı kapat
        const selector = document.getElementById('language-selector');
        if (selector) selector.classList.remove('open');

        // Callback'leri çalıştır
        _langChangeCallbacks.forEach(cb => {
            try { cb(lang); } catch (e) { console.error('Lang change callback error:', e); }
        });
    }

    /** Verilen anahtarın çevirisini döndür */
    function translate(key, lang) {
        lang = lang || getSelectedLang();
        const entry = TRANSLATIONS[key];
        if (!entry) return '';
        return entry[lang] || entry[DEFAULT_LANG] || '';
    }

    /** Sayfadaki tüm [data-i18n] ve [data-i18n-placeholder] elementlerine çeviri uygula */
    function applyTranslations() {
        const lang = getSelectedLang();

        // 1) textContent çevirisi: data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = translate(key, lang);
            if (val) el.textContent = val;
        });

        // 2) placeholder çevirisi: data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = translate(key, lang);
            if (val) el.placeholder = val;
        });
    }

    /**
     * Ürün alanını dile göre döndür (fallback mantığı ile)
     * @param {Object} product - Ürün objesi
     * @param {string} field - Alan tipi: 'name' veya 'desc'
     * @param {string} lang - Dil kodu: 'tm', 'ru', 'en'
     * @returns {string}
     */
    function getProductField(product, field, lang) {
        lang = lang || getSelectedLang();

        // Veritabanındaki gerçek alan adları
        const FIELD_MAP = {
            name: { tm: 'title', ru: 'name_ru', en: 'name_en' },
            desc: { tm: 'description', ru: 'desc_ru', en: 'desc_en' },
            category: { tm: 'category', ru: 'category_ru', en: 'category_en' },
            material: { tm: 'material', ru: 'material_ru', en: 'material_en' }
        };

        const config = FIELD_MAP[field];
        if (!config) return product[field] || '';

        // İstenen dildeki veriyi bul, yoksa TM (varsayılan) verisini döndür
        const targetField = config[lang];
        const fallbackField = config[DEFAULT_LANG];

        return (product[targetField] && product[targetField].trim() !== '')
            ? product[targetField]
            : (product[fallbackField] || '');
    }

    /**
     * Kategori adını dile göre döndür
     * @param {Object} cat - Kategori objesi (name, name_ru, name_en)
     * @param {string} lang - Dil kodu
     * @returns {string}
     */
    function getCategoryName(cat, lang) {
        lang = lang || getSelectedLang();
        if (lang === 'tm') return cat.name || '';
        return cat['name_' + lang] || cat.name || '';
    }

    /** Dil değiştiğinde çağrılacak callback kaydet */
    function onLanguageChange(callback) {
        if (typeof callback === 'function') {
            _langChangeCallbacks.push(callback);
        }
    }

    // --- BAŞLATMA ---
    document.addEventListener('DOMContentLoaded', () => {
        const lang = getSelectedLang();
        const LANG_LABELS = { tm: 'TM', ru: 'RU', en: 'EN' };

        // Aktif seçeneği işaretle
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
        });

        // Toggle aç/kapat
        const toggle = document.getElementById('lang-toggle');
        const selector = document.getElementById('language-selector');
        if (toggle && selector) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                selector.classList.toggle('open');
            });
        }

        // Seçenek tıklaması
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', () => {
                setSelectedLang(opt.getAttribute('data-lang'));
            });
        });

        // Dışına tıklayınca kapat
        document.addEventListener('click', (e) => {
            if (selector && !selector.contains(e.target)) {
                selector.classList.remove('open');
            }
        });

        // İlk yüklemede çevirileri uygula
        applyTranslations();
    });

    // --- GLOBAL ERİŞİM ---
    window.getSelectedLang = getSelectedLang;
    window.setSelectedLang = setSelectedLang;
    window.translate = translate;
    window.applyTranslations = applyTranslations;
    window.getProductField = getProductField;
    window.getCategoryName = getCategoryName;
    window.onLanguageChange = onLanguageChange;
    window.SHOWLY_TRANSLATIONS = TRANSLATIONS;

})();
