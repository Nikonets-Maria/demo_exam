import psycopg2
from psycopg2 import sql
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import hashlib
import datetime
import re
from flask import send_from_directory

app = Flask(__name__)
app.secret_key = 'my-secret-key'
CORS(app)

def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        port="5432",  
        database="dem_exam",
        user="postgres",
        password="pa$$w0rd"  
    )
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# Раздача фронтенда
@app.route('/')
def serve_frontend():
    return send_from_directory('static', 'index.html')

# ==================== РЕГИСТРАЦИЯ ====================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    login = data.get('login')
    password = data.get('password')
    full_name = data.get('full_name')
    phone = data.get('phone')
    email = data.get('email')
    
    # Проверка обязательных полей
    if not all([login, password, full_name, phone, email]):
        return jsonify({'error': 'Все поля обязательны'}), 400
    
    # Валидация логина (латиница и цифры, не менее 6 символов)
    if not re.match(r'^[a-zA-Z0-9]{6,}$', login):
        return jsonify({'error': 'Логин должен содержать только латиницу и цифры, не менее 6 символов'}), 400
    
    # Валидация пароля (не менее 8 символов)
    if len(password) < 8:
        return jsonify({'error': 'Пароль должен быть не менее 8 символов'}), 400
    
    # Валидация ФИО (кириллица и пробелы)
    if not re.match(r'^[а-яА-ЯёЁ\s]+$', full_name):
        return jsonify({'error': 'ФИО должно содержать только буквы кириллицы и пробелы'}), 400
    
    # Валидация телефона (формат: 8(XXX)XXX-XX-XX)
    if not re.match(r'^8\(\d{3}\)\d{3}-\d{2}-\d{2}$', phone):
        return jsonify({'error': 'Телефон должен быть в формате 8(XXX)XXX-XX-XX'}), 400
    
    # Валидация email
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Некорректный формат email'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """INSERT INTO users (login, password_hash, full_name, phone, email) 
               VALUES (%s, %s, %s, %s, %s)""",
            (login, hash_password(password), full_name, phone, email)
        )
        conn.commit()
        return jsonify({'message': 'Регистрация успешна'}), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Пользователь с таким логином уже существует'}), 409
    finally:
        cur.close()
        conn.close()

# ==================== АВТОРИЗАЦИЯ ====================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    login = data.get('login')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, login, password_hash, role, is_blocked, last_login FROM users WHERE login = %s",
        (login,)
    )
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if not user or user[2] != hash_password(password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401
    
    if user[4]:
        return jsonify({'error': 'Пользователь заблокирован'}), 403
    
    # Обновляем время последнего входа
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET last_login = %s WHERE id = %s", (datetime.datetime.now(), user[0]))
    conn.commit()
    cur.close()
    conn.close()
    
    session['user_id'] = user[0]
    session['login'] = user[1]
    session['role'] = user[3]
    
    return jsonify({'message': 'Вы успешно авторизовались', 'role': user[3]})

# ==================== ВЫХОД ====================
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Выход выполнен'})

# ==================== ЗАЯВКИ ====================
@app.route('/api/applications', methods=['POST'])
def create_application():
    if 'user_id' not in session:
        return jsonify({'error': 'Необходима авторизация'}), 401
    
    data = request.json
    course_name = data.get('course_name')
    start_date = data.get('start_date')
    payment_method = data.get('payment_method')
    
    if not all([course_name, start_date, payment_method]):
        return jsonify({'error': 'Заполните все поля'}), 400
    
    if payment_method not in ['наличные', 'перевод по номеру телефона']:
        return jsonify({'error': 'Неверный способ оплаты'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO applications (user_id, course_name, start_date, payment_method, status) 
           VALUES (%s, %s, %s, %s, 'Новая')""",
        (session['user_id'], course_name, start_date, payment_method)
    )
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Заявка отправлена на рассмотрение'}), 201

@app.route('/api/my_applications', methods=['GET'])
def my_applications():
    if 'user_id' not in session:
        return jsonify({'error': 'Авторизуйтесь'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, course_name, start_date, payment_method, status, created_at
        FROM applications
        WHERE user_id = %s
        ORDER BY created_at DESC
    """, (session['user_id'],))
    
    apps = [{
        'id': row[0],
        'course_name': row[1],
        'start_date': str(row[2]),
        'payment_method': row[3],
        'status': row[4],
        'created_at': str(row[5])
    } for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    return jsonify(apps)

# ==================== ОТЗЫВЫ ====================
@app.route('/api/reviews', methods=['POST'])
def add_review():
    if 'user_id' not in session:
        return jsonify({'error': 'Авторизуйтесь'}), 401
    
    data = request.json
    application_id = data.get('application_id')
    rating = data.get('rating')
    comment = data.get('comment')
    
    if not application_id or not rating:
        return jsonify({'error': 'Укажите заявку и оценку'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Проверка, что заявка принадлежит пользователю и имеет статус "Обучение завершено"
    cur.execute(
        "SELECT id FROM applications WHERE id = %s AND user_id = %s AND status = 'Обучение завершено'",
        (application_id, session['user_id'])
    )
    if not cur.fetchone():
        return jsonify({'error': 'Нельзя оставить отзыв для этой заявки'}), 403
    
    cur.execute(
        "INSERT INTO reviews (user_id, application_id, rating, comment) VALUES (%s, %s, %s, %s)",
        (session['user_id'], application_id, rating, comment)
    )
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Отзыв добавлен'}), 201

@app.route('/api/my_reviews', methods=['GET'])
def my_reviews():
    if 'user_id' not in session:
        return jsonify({'error': 'Авторизуйтесь'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, a.course_name, r.rating, r.comment, r.created_at
        FROM reviews r
        JOIN applications a ON r.application_id = a.id
        WHERE r.user_id = %s
        ORDER BY r.created_at DESC
    """, (session['user_id'],))
    
    reviews = [{
        'id': row[0],
        'course_name': row[1],
        'rating': row[2],
        'comment': row[3] or '',
        'created_at': str(row[4])
    } for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    return jsonify(reviews)

@app.route('/api/completed_applications', methods=['GET'])
def completed_applications():
    if 'user_id' not in session:
        return jsonify({'error': 'Авторизуйтесь'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, course_name, start_date
        FROM applications
        WHERE user_id = %s AND status = 'Обучение завершено'
        ORDER BY created_at DESC
    """, (session['user_id'],))
    
    apps = [{
        'id': row[0],
        'course_name': row[1],
        'start_date': str(row[2])
    } for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    return jsonify(apps)

# ==================== АДМИН-МЕТОДЫ ====================
@app.route('/api/admin/applications', methods=['GET'])
def admin_applications():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.id, u.login, a.course_name, a.start_date, a.payment_method, a.status
        FROM applications a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
    """)
    
    apps = [{
        'id': row[0],
        'user_login': row[1],
        'course_name': row[2],
        'start_date': str(row[3]),
        'payment_method': row[4],
        'status': row[5]
    } for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    return jsonify(apps)

@app.route('/api/admin/applications/<int:app_id>', methods=['PUT'])
def update_application_status(app_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    data = request.json
    new_status = data.get('status')
    
    if new_status not in ['Идет обучение', 'Обучение завершено']:
        return jsonify({'error': 'Неверный статус'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE applications SET status = %s WHERE id = %s", (new_status, app_id))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Статус обновлен'})

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, login, full_name, phone, email, role, is_blocked FROM users WHERE role != 'admin'")
    
    users = [{
        'id': row[0],
        'login': row[1],
        'full_name': row[2] or '',
        'phone': row[3] or '',
        'email': row[4] or '',
        'role': row[5],
        'is_blocked': row[6]
    } for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    return jsonify(users)


# Проверка сессии
@app.route('/api/check_session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'role': session.get('role'),
            'login': session.get('login')
        })
    return jsonify({'authenticated': False})

# Раздача статических HTML-файлов
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)


@app.route('/api/admin/users/<int:user_id>/block', methods=['PUT'])
def block_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_blocked = TRUE WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Пользователь заблокирован'})

@app.route('/api/admin/users/<int:user_id>/unblock', methods=['PUT'])
def unblock_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Доступ запрещен'}), 403
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_blocked = FALSE WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Пользователь разблокирован'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)