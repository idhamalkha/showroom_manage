# Showroom Finance Management System

Sistem manajemen keuangan untuk showroom mobil dengan fitur payroll, absensi, cicilan, dan tracking penjualan.

## Deskripsi Project

Aplikasi full-stack untuk mengelola operasional showroom mobil termasuk:
- **Backend**: FastAPI dengan Python
- **Frontend**: Vue 3 + TypeScript + Tailwind CSS
- **Database**: PostgreSQL (NeonDB)
- **Storage**: GitHub Repository untuk image management

## Struktur Folder

```
showroom_manage/
├── backend/              # API Backend (FastAPI)
│   └── app/
│       ├── models/       # Database Models (SQLAlchemy ORM)
│       ├── repositories/ # Data Access Layer
│       ├── routes/       # API Endpoints
│       ├── schemas/      # Pydantic Schemas
│       ├── services/     # Business Logic
│       ├── database/     # Database Configuration
│       └── utils/        # Utility Functions
├── frontend/             # Frontend Application
│   └── showroom-fe/      # Vue 3 Project
├── .gitignore            # Git ignore rules
├── README.md             # Dokumentasi ini
└── LICENSE               # MIT License
```

## Setup Lokal

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL atau NeonDB

### Backend Setup

1. **Clone Repository**
   ```bash
   git clone git@github.com:idhamalkha/showroom_manage.git
   cd showroom_manage
   ```

2. **Setup Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Configure Environment**
   - Copy `.env.example` ke `.env` (jika ada)
   - Update konfigurasi database dan credentials Anda

5. **Run Backend**
   ```bash
   python app/main.py
   # atau dengan uvicorn
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Navigate to Frontend**
   ```bash
   cd frontend/showroom-fe
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Perbedaan File-File Sensitif

Beberapa file tidak disertakan di repository publik untuk alasan keamanan. Berikut penjelasannya:

### 1. **connection_true.py vs connection.py**

#### `connection_true.py` (Excluded - Contains Real Credentials)
```python
DATABASE_URL = "postgresql://neondb_owner:npg_IisNp5C6gLWQ@ep-little-block-a1iveyfa-pooler.ap-southeast-1.aws.neon.tech/neondb"
```
- ✋ **Actual database credentials**
- ✋ **Hardcoded password**
- ✋ **Real connection string**

#### `connection.py` (Included - Template)
```python
DATABASE_URL = "link db"
```
- ✅ **Placeholder untuk credentials**
- ✅ **Safe untuk public repository**
- ✅ **Template untuk setup lokal**

**Kegunaan**: Setup lokal harus replace `"link db"` dengan connection string mereka sendiri.

---

### 2. **github_storage_true.py vs github_storage.py**

#### `github_storage_true.py` (Excluded - Contains Real Token & Repo)
```python
self.token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
self.repo = self.gh.get_repo("username/repo-images")
return f"https://raw.githubusercontent.com/username/repo-images/main/images/{file_name}"
```
- ✋ **Actual GitHub Personal Access Token**
- ✋ **Real GitHub username**
- ✋ **Real repository name**

#### `github_storage.py` (Included - Template)
```python
self.token = "token anda"
self.repo = self.gh.get_repo("nama_github/repo")
return f"https://raw.githubusercontent.com/nama_github/nama_repo/main/images/{file_name}"
```
- ✅ **Placeholder untuk GitHub token**
- ✅ **Template untuk repository**
- ✅ **Safe untuk public repository**

**Kegunaan**: Setup lokal harus replace:
- `"token anda"` dengan GitHub Personal Access Token mereka
- `"nama_github/repo"` dengan `"username/repository-name"` mereka

---

### 3. **.env (Excluded - Contains Sensitive Data)**

File `.env` tidak disertakan karena berisi:
- Database credentials
- Email SMTP password
- API keys
- Secret keys untuk JWT
- Frontend URL (bisa berbeda per environment)

Untuk setup lokal, buat file `.env` dengan template:
```
DATABASE_URL=your_database_url
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your_email@gmail.com
SENDER_PASSWORD=your_app_password
SENDER_NAME=Showroom Finance
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:5173
```

## File yang Di-Ignore

Berdasarkan `.gitignore`:
- `backend/app/database/connection_true.py` - Real database connection
- `backend/app/utils/github_storage_true.py` - Real GitHub credentials
- `.env` - Environment variables dengan credentials
- `__pycache__/` - Python cache
- `venv/` - Virtual environment
- `node_modules/` - Node packages
- `.vscode/` - IDE settings (optional)

## Workflow Setup

1. Clone repo dengan file template
2. Rename/copy file template sesuai kebutuhan lokal
3. Setup credentials di file yang sudah direname
4. Update `.env` dengan credentials sendiri
5. Jangan push file yang sudah berisi credentials

## Development Guidelines

### Backend
- Gunakan SQLAlchemy ORM untuk database queries
- Organize code dengan pattern: models → repositories → services → routes
- Write docstrings untuk semua public methods
- Validate input menggunakan Pydantic schemas

### Frontend
- Gunakan Composition API di Vue 3
- Organize components dengan feature-based structure
- Use Tailwind CSS untuk styling
- Maintain type safety dengan TypeScript

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add your feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Create Pull Request

## Troubleshooting

### Backend tidak bisa connect ke database
- Pastikan `.env` atau `connection.py` sudah punya DATABASE_URL yang benar
- Check koneksi internet ke NeonDB
- Verify credentials di `.env`

### GitHub image upload fails
- Pastikan `github_storage.py` sudah dikonfigure dengan GitHub token
- Token harus punya permission `repo` scope
- Repository harus exist di GitHub

### Frontend tidak bisa connect ke backend
- Pastikan backend running di port 8000
- Check CORS configuration di backend
- Verify FRONTEND_URL di `.env` match dengan frontend URL

## License

MIT License - see LICENSE file for details

---

**Last Updated**: December 16, 2025
**Version**: 1.0.0
