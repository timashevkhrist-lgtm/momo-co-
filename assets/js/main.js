/* ==========================================================================
   MOMO & CO. — интерактив страницы
   Зависит от data.js (CAFE, spaceZones, menuItems).
   ========================================================================== */

/* ---------- State ---------- */
const cart = new Map();           // id -> количество
const guestCounts = { adults: 1, children: 1 };
let toastTimer = null;

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);

function formatPrice(value) {
    return `${value.toLocaleString('ru-RU')} ₽`;
}

function localISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateRu(iso) {
    if (!iso) return 'сегодня';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/* Текущее время в часовом поясе кафе (а не посетителя) */
function getCafeNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CAFE.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    const weekend = ['Sat', 'Sun'].includes(get('weekday'));
    return { hour: Number(get('hour')), minute: Number(get('minute')), weekend };
}

/* ---------- Clock & open status ---------- */
function updateLiveClock() {
    const now = getCafeNow();
    const pad = (n) => String(n).padStart(2, '0');
    $('currentClock').textContent = `${pad(now.hour)}:${pad(now.minute)}`;

    const { open, close } = now.weekend ? CAFE.hours.weekend : CAFE.hours.weekday;
    const isOpen = now.hour >= open && now.hour < close;
    $('openStatusText').textContent = isOpen
        ? `Открыто до ${pad(close)}:00`
        : `Закрыто · откроемся в ${pad(open)}:00`;
    $('openStatusDot').classList.toggle('bg-cobalt', isOpen);
    $('openStatusDot').classList.toggle('animate-pulse', isOpen);
    $('openStatusDot').classList.toggle('bg-ink-faint', !isOpen);
}

/* ---------- Space zones ---------- */
function selectZone(zoneKey) {
    const data = spaceZones[zoneKey];
    if (!data) return;

    document.querySelectorAll('.zone-tab-btn').forEach((btn) => {
        const active = btn.id === `tab-${zoneKey}`;
        btn.classList.toggle('bg-cobalt', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-ink', !active);
        btn.setAttribute('aria-selected', String(active));
    });

    const img = $('zoneImage');
    img.style.opacity = '0.3';
    setTimeout(() => {
        img.src = data.image;
        img.alt = data.title;
        $('zoneNumber').textContent = data.number;
        $('zoneTitle').textContent = data.title;
        $('zoneDesc').textContent = data.desc;
        $('zoneTag').textContent = data.tag;
        $('zoneAmenities').innerHTML = data.amenities
            .map((a) => `<span class="px-3 py-1 bg-paper text-ink font-mono text-xs rounded-lg hairline-all">${a}</span>`)
            .join('');
        img.style.opacity = '1';
    }, 150);
}

/* ---------- Menu ---------- */
function renderMenu(items) {
    const container = $('menuItemsGrid');
    if (!container) return;

    container.innerHTML = items.map((item) => `
        <article class="rounded-2xl bg-white hairline-all overflow-hidden flex flex-col justify-between card-editorial p-5">
            <div>
                <div class="h-44 rounded-xl overflow-hidden mb-4 relative bg-paper-tint">
                    <img src="${item.img}"
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://placehold.co/600x440/F1EFEA/0038FF?text=' + encodeURIComponent(this.alt);"
                         class="w-full h-full object-cover">
                    <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-cobalt font-mono text-[10px] font-bold uppercase">
                        ${item.tag}
                    </span>
                </div>
                <div class="flex justify-between items-start gap-2 mb-2">
                    <h4 class="font-syne font-bold text-base text-ink uppercase leading-snug">${item.title}</h4>
                    <span class="font-syne font-extrabold text-base text-cobalt shrink-0">${formatPrice(item.price)}</span>
                </div>
                <p class="text-xs text-ink-muted leading-relaxed font-light mb-4">${item.desc}</p>
            </div>

            <div class="pt-4 hairline-t flex items-center justify-between">
                <span class="font-mono text-[11px] text-ink-muted">${item.cal}</span>
                <button onclick="addToCart(${item.id})" class="px-3 py-1.5 rounded-lg hairline-all hover:bg-cobalt hover:text-white font-mono text-xs transition-colors flex items-center gap-1">
                    <span>+ К столу</span>
                </button>
            </div>
        </article>
    `).join('');
}

function filterMenu(category, button) {
    document.querySelectorAll('.menu-filter-btn').forEach((btn) => {
        const active = btn === button;
        btn.classList.toggle('bg-cobalt', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-ink', !active);
        btn.setAttribute('aria-pressed', String(active));
    });

    renderMenu(category === 'all' ? menuItems : menuItems.filter((i) => i.category === category));
}

/* ---------- Cart / pre-order ---------- */
function addToCart(itemId) {
    const item = menuItems.find((i) => i.id === itemId);
    if (!item) return;
    cart.set(itemId, (cart.get(itemId) || 0) + 1);
    updateCartUI();
    showQuickToast(`Добавлено: ${item.title}`);
}

function clearCart(silent = false) {
    cart.clear();
    updateCartUI();
    if (!silent) showQuickToast('Список предзаказа очищен');
}

function getCartSummary() {
    let count = 0;
    let total = 0;
    const lines = [];
    cart.forEach((qty, id) => {
        const item = menuItems.find((i) => i.id === id);
        count += qty;
        total += item.price * qty;
        lines.push(qty > 1 ? `${item.title} ×${qty}` : item.title);
    });
    return { count, total, lines };
}

function updateCartUI() {
    const bar = $('quickOrderBar');
    const toast = $('toastNotification');
    const { count, total } = getCartSummary();
    const visible = count > 0;

    if (visible) {
        $('cartCount').textContent = count;
        $('cartSum').textContent = formatPrice(total);
    }
    bar.classList.toggle('translate-y-32', !visible);
    bar.classList.toggle('opacity-0', !visible);
    bar.classList.toggle('pointer-events-none', !visible);

    // Тост не должен перекрывать панель предзаказа
    toast.classList.toggle('bottom-28', visible);
    toast.classList.toggle('bottom-6', !visible);
}

function openBookingWithOrder() {
    openBookingModal();
    const { lines } = getCartSummary();
    $('modalNotes').value = `Предзаказ: ${lines.join(', ')}`;
}

/* ---------- Guests counter ---------- */
function modifyGuestCount(type, delta) {
    if (type === 'adults') {
        guestCounts.adults = Math.max(1, Math.min(8, guestCounts.adults + delta));
        $('adultsDisplay').textContent = guestCounts.adults;
    } else {
        guestCounts.children = Math.max(0, Math.min(6, guestCounts.children + delta));
        $('childrenDisplay').textContent = guestCounts.children;
    }
}

/* ---------- Forms ---------- */
function handleReservationSubmit(e) {
    e.preventDefault();
    const date = $('resDate').value;
    const time = $('resTime').value;
    const name = $('custName').value.trim();
    const phone = $('custPhone').value.trim();

    showSuccessDialog(
        `Спасибо, ${name}! Столик забронирован на ${formatDateRu(date)} в ${time}. ` +
        `Взрослых: ${guestCounts.adults}, детей: ${guestCounts.children}. Детали отправим на ${phone}.`
    );
    e.target.reset();
    $('resDate').value = localISODate();
}

function handleModalReservationSubmit(e) {
    e.preventDefault();
    const name = $('modalName').value.trim();
    const phone = $('modalPhone').value.trim();
    closeBookingModal();
    showSuccessDialog(`Спасибо, ${name}! Ваша бронь принята. Мы перезвоним по номеру ${phone} для подтверждения готовности стола.`);
    e.target.reset();
    clearCart(true);
}

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = $('nlEmail').value.trim();
    showQuickToast(`Спасибо! ${email} подписан на рассылку Momo Letters.`);
    e.target.reset();
}

/* ---------- Modals ---------- */
function setScrollLock(locked) {
    document.body.classList.toggle('is-locked', locked);
}

function openBookingModal() {
    const backdrop = $('bookingModalBackdrop');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('is-open');
    setScrollLock(true);
    setTimeout(() => $('modalName').focus(), 50);
}

function closeBookingModal() {
    const backdrop = $('bookingModalBackdrop');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    backdrop.classList.remove('is-open');
    setScrollLock(false);
}

function showSuccessDialog(message) {
    $('successDialogDetails').textContent = message;
    $('successDialogBackdrop').classList.remove('opacity-0', 'pointer-events-none');
    setScrollLock(true);
}

function closeSuccessDialog() {
    $('successDialogBackdrop').classList.add('opacity-0', 'pointer-events-none');
    setScrollLock(false);
}

/* ---------- Toast ---------- */
function showQuickToast(msg) {
    const toast = $('toastNotification');
    $('toastText').textContent = msg;
    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 3000);
}

/* ---------- Clipboard ---------- */
async function copyAddressToClipboard() {
    try {
        await navigator.clipboard.writeText(CAFE.address);
        showQuickToast('Адрес скопирован в буфер обмена');
    } catch {
        // Фолбэк для file:// и старых браузеров
        const dummy = document.createElement('textarea');
        dummy.value = CAFE.address;
        document.body.appendChild(dummy);
        dummy.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(dummy);
        showQuickToast(ok ? 'Адрес скопирован в буфер обмена' : CAFE.address);
    }
}

/* ---------- Mobile menu ---------- */
function initMobileMenu() {
    const toggle = $('mobileMenuToggle');
    const drawer = $('mobileDrawer');

    toggle.addEventListener('click', () => {
        const isHidden = drawer.classList.toggle('hidden');
        toggle.setAttribute('aria-expanded', String(!isHidden));
    });

    document.querySelectorAll('.mobile-link').forEach((link) => {
        link.addEventListener('click', () => {
            drawer.classList.add('hidden');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    renderMenu(menuItems);
    initMobileMenu();

    updateLiveClock();
    setInterval(updateLiveClock, 15000);

    // Дата брони: сегодня по умолчанию, прошлые даты недоступны
    const dateInput = $('resDate');
    dateInput.value = localISODate();
    dateInput.min = localISODate();

    // Закрытие модалок по клику на фон и по Esc
    $('bookingModalBackdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeBookingModal();
    });
    $('successDialogBackdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSuccessDialog();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeBookingModal();
        closeSuccessDialog();
    });
});
