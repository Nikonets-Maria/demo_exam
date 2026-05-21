// API-запросы
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

// Проверка авторизации при загрузке страницы
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

// Выход
async function logout() {
    await apiRequest('/api/logout', 'POST', {});
    window.location.href = '/index.html';
}

// Регистрация (для страницы register.html)
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

// Вход (для страницы login.html)
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

// Функции для страницы пользователя (user.html)
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

// let currentSlide = 0;
let slidesCount = 0;

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
        
        // Создаём карточки для каждой заявки
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
        
        // Настройка слайдера
        const cardsPerView = getCardsPerView();
        slidesCount = Math.ceil(apps.length / cardsPerView);
        currentSlide = 0;
        
        // Создаём точки навигации
        dotsContainer.innerHTML = '';
        for (let i = 0; i < slidesCount; i++) {
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
    
    const cardWidth = cards[0].offsetWidth + 20; // + margin
    const offset = currentSlide * cardsPerView * cardWidth;
    track.style.transform = `translateX(-${offset}px)`;
    
    // Обновляем активную точку
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

function nextSlide() {
    if (currentSlide < slidesCount - 1) {
        currentSlide++;
        updateSliderPosition();
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        updateSliderPosition();
    }
}

function goToSlide(index) {
    currentSlide = index;
    updateSliderPosition();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Добавить обработчик изменения размера окна для адаптивности
window.addEventListener('resize', function() {
    if (document.getElementById('applications-slider')) {
        loadMyApplications();
    }
});

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
                <strong>${review.course_name}</strong>
                <div class="review-comment">${review.comment || 'Без комментария'}</div>
                <div class="review-date">${review.created_at}</div>
            `;
            container.appendChild(div);
        });
    } catch(e) {
        console.error('Ошибка загрузки отзывов:', e);
    }
}

// Функции для страницы администратора (admin.html)
async function loadAdminPage() {
    const auth = await checkAuth();
    if (auth.role !== 'admin') {
        window.location.href = '/user.html';
        return;
    }
    
    document.getElementById('admin-name').textContent = auth.login;
    loadAllApplications();
}

async function loadAllApplications() {
    try {
        const apps = await apiRequest('/api/admin/applications', 'GET');
        const tbody = document.querySelector('#all-applications-table tbody');
        tbody.innerHTML = '';
        
        apps.forEach(app => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = app.id;
            row.insertCell(1).textContent = app.user_login;
            row.insertCell(2).textContent = app.course_name;
            row.insertCell(3).textContent = app.start_date;
            row.insertCell(4).textContent = app.payment_method;
            row.insertCell(5).textContent = app.status;
            
            const cellAction = row.insertCell(6);
            if (app.status === 'Новая') {
                const btnStart = document.createElement('button');
                btnStart.textContent = 'Идет обучение';
                btnStart.className = 'success';
                btnStart.onclick = () => updateStatus(app.id, 'Идет обучение');
                
                const btnComplete = document.createElement('button');
                btnComplete.textContent = 'Обучение завершено';
                btnComplete.className = 'success';
                btnComplete.onclick = () => updateStatus(app.id, 'Обучение завершено');
                
                cellAction.appendChild(btnStart);
                cellAction.appendChild(btnComplete);
            } else if (app.status === 'Идет обучение') {
                const btnComplete = document.createElement('button');
                btnComplete.textContent = 'Обучение завершено';
                btnComplete.className = 'success';
                btnComplete.onclick = () => updateStatus(app.id, 'Обучение завершено');
                cellAction.appendChild(btnComplete);
            } else {
                cellAction.textContent = 'Завершено';
            }
        });
    } catch(e) {
        console.error('Ошибка загрузки заявок:', e);
    }
}

async function updateStatus(appId, status) {
    try {
        await apiRequest(`/api/admin/applications/${appId}`, 'PUT', { status });
        alert('Статус обновлён');
        loadAllApplications();
    } catch(e) {
        alert(e.message);
    }
}

// Слайд-шоу на главной странице
let slideIndex = 1;
let slideInterval;

function showSlides(n) {
    const slides = document.getElementsByClassName('slide');
    const dots = document.getElementsByClassName('dot');
    
    if (n > slides.length) {
        slideIndex = 1;
    }
    if (n < 1) {
        slideIndex = slides.length;
    }
    
    for (let i = 0; i < slides.length; i++) {
        slides[i].classList.remove('active');
    }
    
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove('active');
    }
    
    slides[slideIndex - 1].classList.add('active');
    dots[slideIndex - 1].classList.add('active');
}

function changeSlide(n) {
    clearInterval(slideInterval);
    slideIndex += n;
    showSlides(slideIndex);
    startAutoSlide();
}

function currentSlide(n) {
    clearInterval(slideInterval);
    slideIndex = n;
    showSlides(slideIndex);
    startAutoSlide();
}

function startAutoSlide() {
    slideInterval = setInterval(function() {
        slideIndex++;
        showSlides(slideIndex);
    }, 3000);
}

// Запуск слайд-шоу при загрузке страницы
if (document.querySelector('.slideshow-container')) {
    showSlides(slideIndex);
    startAutoSlide();
}

// Автоматический запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    
    if (path.includes('user.html')) {
        loadUserPage();
    } else if (path.includes('admin.html')) {
        loadAdminPage();
    } else if (path.includes('login.html')) {
        // страница входа, ничего не делаем
    } else if (path.includes('register.html')) {
        // страница регистрации, ничего не делаем
    } else if (path.includes('index.html')) {
        // главная страница, ничего не делаем
    }
});