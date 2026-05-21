// ==================== API-ЗАПРОСЫ ====================
async function apiRequest(url, method, body) {
    const response = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Ошибка запроса');
    }
    return data;
}

// ==================== АВТОРИЗАЦИЯ ====================
async function checkAuth() {
    try {
        const data = await apiRequest('/api/check_session', 'GET');
        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
        return data;
    } catch(e) {
        window.location.href = '/login.html';
    }
}

async function logout() {
    await apiRequest('/api/logout', 'POST', {});
    window.location.href = '/index.html';
}

async function register() {
    const login = document.getElementById('reg-login').value;
    const password = document.getElementById('reg-password').value;
    const full_name = document.getElementById('reg-fullname').value;
    const phone = document.getElementById('reg-phone').value;
    const email = document.getElementById('reg-email').value;
    
    const errorDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');
    
    try {
        await apiRequest('/api/register', 'POST', {
            login, password, full_name, phone, email
        });
        successDiv.style.display = 'block';
        successDiv.textContent = 'Регистрация успешна! Перенаправление на страницу входа...';
        errorDiv.style.display = 'none';
        
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
    } catch(e) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = e.message;
        successDiv.style.display = 'none';
    }
}

async function login() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const data = await apiRequest('/api/login', 'POST', { login, password });
        errorDiv.style.display = 'none';
        
        if (data.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/user.html';
        }
    } catch(e) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = e.message;
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== СТРАНИЦА ПОЛЬЗОВАТЕЛЯ ====================
let applicationSlide = 0;
let applicationSlidesCount = 0;

async function loadUserPage() {
    const auth = await checkAuth();
    if (auth.role === 'admin') {
        window.location.href = '/admin.html';
        return;
    }
    
    document.getElementById('user-name').textContent = auth.login;
    loadMyApplications();
    loadCompletedApplications();
    loadMyReviews();
}

async function createApplication() {
    const course_name = document.getElementById('course-name').value;
    const start_date = document.getElementById('start-date').value;
    const payment_method = document.getElementById('payment-method').value;
    
    if (!course_name || !start_date) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        await apiRequest('/api/applications', 'POST', {
            course_name, start_date, payment_method
        });
        alert('Заявка отправлена на рассмотрение');
        document.getElementById('course-name').value = '';
        document.getElementById('start-date').value = '';
        loadMyApplications();
    } catch(e) {
        alert(e.message);
    }
}

async function loadMyApplications() {
    try {
        const apps = await apiRequest('/api/my_applications', 'GET');
        const track = document.getElementById('applications-slider');
        const emptyDiv = document.getElementById('slider-empty');
        const dotsContainer = document.getElementById('slider-dots');
        
        if (!apps || apps.length === 0) {
            track.innerHTML = '';
            emptyDiv.style.display = 'block';
            dotsContainer.innerHTML = '';
            return;
        }
        
        emptyDiv.style.display = 'none';
        track.innerHTML = '';
        
        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'application-card';
            
            let statusClass = '';
            if (app.status === 'Новая') statusClass = 'status-new';
            else if (app.status === 'Идет обучение') statusClass = 'status-learning';
            else if (app.status === 'Обучение завершено') statusClass = 'status-completed';
            
            card.innerHTML = `
                <h4>${escapeHtml(app.course_name)}</h4>
                <p><strong>Дата начала:</strong> ${app.start_date}</p>
                <p><strong>Способ оплаты:</strong> ${app.payment_method}</p>
                <p><strong>Дата подачи:</strong> ${app.created_at}</p>
                <span class="status ${statusClass}">${app.status}</span>
            `;
            track.appendChild(card);
        });
        
        const cardsPerView = getCardsPerView();
        applicationSlidesCount = Math.ceil(apps.length / cardsPerView);
        applicationSlide = 0;
        
        dotsContainer.innerHTML = '';
        for (let i = 0; i < applicationSlidesCount; i++) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            if (i === 0) dot.classList.add('active');
            dot.onclick = () => goToSlide(i);
            dotsContainer.appendChild(dot);
        }
        
        updateSliderPosition();
    } catch(e) {
        console.error('Ошибка загрузки заявок:', e);
    }
}

function getCardsPerView() {
    const width = window.innerWidth;
    if (width < 768) return 1;
    if (width < 1024) return 2;
    return 3;
}

function updateSliderPosition() {
    const cardsPerView = getCardsPerView();
    const track = document.getElementById('applications-slider');
    const cards = track.children;
    
    if (cards.length === 0) return;
    
    const cardWidth = cards[0].offsetWidth + 20;
    const offset = applicationSlide * cardsPerView * cardWidth;
    track.style.transform = `translateX(-${offset}px)`;
    
    const dots = document.querySelectorAll('.slider-dots .dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === applicationSlide);
    });
}

function nextSlide() {
    if (applicationSlide < applicationSlidesCount - 1) {
        applicationSlide++;
        updateSliderPosition();
    }
}

function prevSlide() {
    if (applicationSlide > 0) {
        applicationSlide--;
        updateSliderPosition();
    }
}

function goToSlide(index) {
    applicationSlide = index;
    updateSliderPosition();
}

async function loadCompletedApplications() {
    try {
        const apps = await apiRequest('/api/completed_applications', 'GET');
        const select = document.getElementById('review-application');
        select.innerHTML = '<option value="">Выберите завершённый курс</option>';
        
        apps.forEach(app => {
            const option = document.createElement('option');
            option.value = app.id;
            option.textContent = app.course_name + ' (' + app.start_date + ')';
            select.appendChild(option);
        });
    } catch(e) {
        console.error('Ошибка загрузки завершённых курсов:', e);
    }
}

async function submitReview() {
    const application_id = document.getElementById('review-application').value;
    const rating = document.getElementById('review-rating').value;
    const comment = document.getElementById('review-comment').value;
    
    if (!application_id) {
        alert('Выберите курс для отзыва');
        return;
    }
    
    try {
        await apiRequest('/api/reviews', 'POST', {
            application_id, rating, comment
        });
        alert('Отзыв успешно добавлен');
        document.getElementById('review-comment').value = '';
        loadMyReviews();
    } catch(e) {
        alert(e.message);
    }
}

async function loadMyReviews() {
    try {
        const reviews = await apiRequest('/api/my_reviews', 'GET');
        const container = document.getElementById('my-reviews');
        container.innerHTML = '';
        
        if (reviews.length === 0) {
            container.innerHTML = '<p>У вас пока нет отзывов</p>';
            return;
        }
        
        reviews.forEach(review => {
            const div = document.createElement('div');
            div.className = 'review-card';
            div.innerHTML = `
                <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
                <strong>${escapeHtml(review.course_name)}</strong>
                <div class="review-comment">${escapeHtml(review.comment) || 'Без комментария'}</div>
                <div class="review-date">${review.created_at}</div>
            `;
            container.appendChild(div);
        });
    } catch(e) {
        console.error('Ошибка загрузки отзывов:', e);
    }
}

window.addEventListener('resize', function() {
    if (document.getElementById('applications-slider')) {
        loadMyApplications();
    }
});

// ==================== СЛАЙД-ШОУ НА ГЛАВНОЙ ====================
let mainSlideIndex = 1;
let mainSlideInterval;

function showSlides(n) {
    const slides = document.getElementsByClassName('slide');
    const dots = document.getElementsByClassName('dots')[0];
    if (!slides.length) return;
    
    if (n > slides.length) {
        mainSlideIndex = 1;
    }
    if (n < 1) {
        mainSlideIndex = slides.length;
    }
    
    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove('active');
    }
    
    if (dots) {
        const dotElements = dots.getElementsByClassName('dot');
        for (let i = 0; i < dotElements.length; i++) {
            dotElements[i].classList.remove('active');
        }
        if (dotElements[mainSlideIndex - 1]) {
            dotElements[mainSlideIndex - 1].classList.add('active');
        }
    }
    
    slides[mainSlideIndex - 1].classList.add('active');
}

function changeSlide(n) {
    clearInterval(mainSlideInterval);
    mainSlideIndex += n;
    showSlides(mainSlideIndex);
    startAutoSlide();
}

function setCurrentSlide(n) {
    clearInterval(mainSlideInterval);
    mainSlideIndex = n;
    showSlides(mainSlideIndex);
    startAutoSlide();
}

function startAutoSlide() {
    mainSlideInterval = setInterval(function() {
        mainSlideIndex++;
        showSlides(mainSlideIndex);
    }, 3000);
}

if (document.querySelector('.slideshow-container')) {
    showSlides(mainSlideIndex);
    startAutoSlide();
}

// ==================== АДМИН-ПАНЕЛЬ ====================
let allApplicationsData = [];
let filteredApplicationsData = [];
let adminCurrentPage = 1;
let adminItemsPerPage = 25;
let adminSortField = 'id';
let adminSortOrder = 'asc';
let pendingAction = null;

function showToast(message, type) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'success');
    toast.style.display = 'block';
    
    setTimeout(function() {
        toast.style.display = 'none';
    }, 3000);
}

function showModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    const modalMessage = document.getElementById('modal-message');
    modalMessage.textContent = message;
    pendingAction = onConfirm;
    modal.style.display = 'flex';
}

function confirmAction(confirmed) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.style.display = 'none';
    
    if (confirmed && pendingAction) {
        pendingAction();
    }
    pendingAction = null;
}

function showNotification(message) {
    const modal = document.getElementById('notification-modal');
    if (!modal) return;
    const notificationMessage = document.getElementById('notification-message');
    notificationMessage.textContent = message;
    modal.style.display = 'flex';
}

function closeNotification() {
    const modal = document.getElementById('notification-modal');
    if (modal) modal.style.display = 'none';
}

function applyFilters() {
    const statusFilter = document.getElementById('filter-status');
    const userFilter = document.getElementById('filter-user');
    const courseFilter = document.getElementById('filter-course');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    
    if (!statusFilter) return;
    
    const statusValue = statusFilter.value;
    const userValue = userFilter ? userFilter.value.toLowerCase() : '';
    const courseValue = courseFilter ? courseFilter.value.toLowerCase() : '';
    const dateFromValue = dateFrom ? dateFrom.value : '';
    const dateToValue = dateTo ? dateTo.value : '';
    
    filteredApplicationsData = allApplicationsData.filter(function(app) {
        if (statusValue !== 'all' && app.status !== statusValue) return false;
        if (userValue && !app.user_login.toLowerCase().includes(userValue)) return false;
        if (courseValue && !app.course_name.toLowerCase().includes(courseValue)) return false;
        if (dateFromValue && app.start_date < dateFromValue) return false;
        if (dateToValue && app.start_date > dateToValue) return false;
        return true;
    });
    
    adminCurrentPage = 1;
    sortApplications();
    renderAdminTable();
    renderPagination();
    updateStats();
    showToast('Фильтры применены', 'success');
}

function resetFilters() {
    const statusFilter = document.getElementById('filter-status');
    const userFilter = document.getElementById('filter-user');
    const courseFilter = document.getElementById('filter-course');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    
    if (statusFilter) statusFilter.value = 'all';
    if (userFilter) userFilter.value = '';
    if (courseFilter) courseFilter.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    filteredApplicationsData = allApplicationsData.slice();
    adminCurrentPage = 1;
    sortApplications();
    renderAdminTable();
    renderPagination();
    updateStats();
    showToast('Фильтры сброшены', 'success');
}

function sortByField(field) {
    if (adminSortField === field) {
        adminSortOrder = adminSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        adminSortField = field;
        adminSortOrder = 'asc';
    }
    
    const sortFieldSelect = document.getElementById('sort-field');
    const sortOrderSelect = document.getElementById('sort-order');
    if (sortFieldSelect) sortFieldSelect.value = field;
    if (sortOrderSelect) sortOrderSelect.value = adminSortOrder;
    sortApplications();
    renderAdminTable();
}

function sortApplications() {
    const sortFieldSelect = document.getElementById('sort-field');
    const sortOrderSelect = document.getElementById('sort-order');
    
    const field = sortFieldSelect ? sortFieldSelect.value : adminSortField;
    const order = sortOrderSelect ? sortOrderSelect.value : adminSortOrder;
    adminSortField = field;
    adminSortOrder = order;
    
    filteredApplicationsData.sort(function(a, b) {
        let valA = a[field];
        let valB = b[field];
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (order === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });
}

function changeItemsPerPage() {
    const itemsSelect = document.getElementById('items-per-page');
    if (itemsSelect) {
        adminItemsPerPage = parseInt(itemsSelect.value);
    }
    adminCurrentPage = 1;
    renderAdminTable();
    renderPagination();
}

function getPaginatedData() {
    const start = (adminCurrentPage - 1) * adminItemsPerPage;
    const end = start + adminItemsPerPage;
    return filteredApplicationsData.slice(start, end);
}

function renderPagination() {
    const totalPages = Math.ceil(filteredApplicationsData.length / adminItemsPerPage);
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
        pageInfo.textContent = 'Страница ' + adminCurrentPage + ' из ' + (totalPages || 1);
    }
    
    const firstBtn = document.querySelector('.pagination-btn:first-child');
    const prevBtn = document.querySelector('.pagination-btn:nth-child(2)');
    const nextBtn = document.querySelector('.pagination-btn:nth-child(4)');
    const lastBtn = document.querySelector('.pagination-btn:last-child');
    
    if (firstBtn) firstBtn.disabled = adminCurrentPage === 1;
    if (prevBtn) prevBtn.disabled = adminCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = adminCurrentPage === totalPages || totalPages === 0;
    if (lastBtn) lastBtn.disabled = adminCurrentPage === totalPages || totalPages === 0;
}

function firstPage() {
    adminCurrentPage = 1;
    renderAdminTable();
    renderPagination();
    updateStats();
}

function prevPage() {
    if (adminCurrentPage > 1) {
        adminCurrentPage--;
        renderAdminTable();
        renderPagination();
        updateStats();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredApplicationsData.length / adminItemsPerPage);
    if (adminCurrentPage < totalPages) {
        adminCurrentPage++;
        renderAdminTable();
        renderPagination();
        updateStats();
    }
}

function lastPage() {
    const totalPages = Math.ceil(filteredApplicationsData.length / adminItemsPerPage);
    adminCurrentPage = totalPages || 1;
    renderAdminTable();
    renderPagination();
    updateStats();
}

function updateStats() {
    const statsInfo = document.getElementById('stats-info');
    if (!statsInfo) return;
    
    const total = filteredApplicationsData.length;
    const start = (adminCurrentPage - 1) * adminItemsPerPage + 1;
    const end = Math.min(adminCurrentPage * adminItemsPerPage, total);
    
    if (total === 0) {
        statsInfo.textContent = 'Записей не найдено';
    } else {
        statsInfo.textContent = 'Показано ' + start + '-' + end + ' из ' + total + ' записей';
    }
}

function exportToCSV() {
    if (filteredApplicationsData.length === 0) {
        showNotification('Нет данных для экспорта');
        return;
    }
    
    const headers = ['ID', 'Пользователь', 'Курс', 'Дата начала', 'Способ оплаты', 'Статус'];
    const rows = filteredApplicationsData.map(function(app) {
        return [app.id, app.user_login, app.course_name, app.start_date, app.payment_method, app.status];
    });
    
    const csvLines = [headers.join(',')];
    rows.forEach(function(row) {
        const escapedRow = row.map(function(cell) {
            return '"' + String(cell).replace(/"/g, '""') + '"';
        }).join(',');
        csvLines.push(escapedRow);
    });
    
    const csvContent = csvLines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'applications_' + new Date().toISOString().slice(0,19) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Экспортировано ' + filteredApplicationsData.length + ' записей', 'success');
}

async function loadAllApplications() {
    try {
        const apps = await apiRequest('/api/admin/applications', 'GET');
        allApplicationsData = apps;
        filteredApplicationsData = apps.slice();
        adminCurrentPage = 1;
        sortApplications();
        renderAdminTable();
        renderPagination();
        updateStats();
    } catch(e) {
        console.error('Ошибка загрузки заявок:', e);
        showNotification('Ошибка загрузки данных');
    }
}

function renderAdminTable() {
    const tbody = document.querySelector('#all-applications-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const paginatedData = getPaginatedData();
    
    paginatedData.forEach(function(app) {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = app.id;
        row.insertCell(1).textContent = app.user_login;
        row.insertCell(2).textContent = app.course_name;
        row.insertCell(3).textContent = app.start_date;
        row.insertCell(4).textContent = app.payment_method;
        
        const statusCell = row.insertCell(5);
        let statusClass = '';
        if (app.status === 'Новая') statusClass = 'status-new';
        else if (app.status === 'Идет обучение') statusClass = 'status-learning';
        else if (app.status === 'Обучение завершено') statusClass = 'status-completed';
        statusCell.innerHTML = '<span class="status ' + statusClass + '">' + app.status + '</span>';
        
        const cellAction = row.insertCell(6);
        if (app.status === 'Новая') {
            const btnStart = document.createElement('button');
            btnStart.textContent = 'Идет обучение';
            btnStart.className = 'success';
            btnStart.onclick = (function(id) {
                return function() { confirmUpdateStatus(id, 'Идет обучение'); };
            })(app.id);
            
            const btnComplete = document.createElement('button');
            btnComplete.textContent = 'Обучение завершено';
            btnComplete.className = 'success';
            btnComplete.onclick = (function(id) {
                return function() { confirmUpdateStatus(id, 'Обучение завершено'); };
            })(app.id);
            
            cellAction.appendChild(btnStart);
            cellAction.appendChild(btnComplete);
        } else if (app.status === 'Идет обучение') {
            const btnComplete = document.createElement('button');
            btnComplete.textContent = 'Обучение завершено';
            btnComplete.className = 'success';
            btnComplete.onclick = (function(id) {
                return function() { confirmUpdateStatus(id, 'Обучение завершено'); };
            })(app.id);
            cellAction.appendChild(btnComplete);
        } else {
            cellAction.textContent = 'Завершено';
        }
    });
}

function confirmUpdateStatus(appId, newStatus) {
    const statusText = newStatus === 'Идет обучение' ? 'начать обучение' : 'завершить обучение';
    showModal('Вы уверены, что хотите ' + statusText + ' для заявки #' + appId + '?', async function() {
        await updateStatus(appId, newStatus);
    });
}

async function updateStatus(appId, status) {
    try {
        await apiRequest('/api/admin/applications/' + appId, 'PUT', { status: status });
        showToast('Статус заявки #' + appId + ' обновлён на "' + status + '"', 'success');
        await loadAllApplications();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

async function loadAdminPage() {
    const auth = await checkAuth();
    if (auth.role !== 'admin') {
        window.location.href = '/user.html';
        return;
    }
    
    const adminNameSpan = document.getElementById('admin-name');
    if (adminNameSpan) adminNameSpan.textContent = auth.login;
    await loadAllApplications();
}

// ==================== ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ====================
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    
    if (path.includes('user.html')) {
        loadUserPage();
    } else if (path.includes('admin.html')) {
        loadAdminPage();
    }
});