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

async function loadMyApplications() {
    try {
        const apps = await apiRequest('/api/my_applications', 'GET');
        const tbody = document.querySelector('#my-applications-table tbody');
        tbody.innerHTML = '';
        
        apps.forEach(app => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = app.course_name;
            row.insertCell(1).textContent = app.start_date;
            row.insertCell(2).textContent = app.payment_method;
            row.insertCell(3).textContent = app.status;
            row.insertCell(4).textContent = app.created_at;
        });
    } catch(e) {
        console.error('Ошибка загрузки заявок:', e);
    }
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