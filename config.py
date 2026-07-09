import os
from dotenv import load_dotenv

# Load local .env file if it exists (for local development)
load_dotenv()

class Config:
    # MySQL Database Configuration
    DB_CONFIG = {
        'host': os.environ.get('DB_HOST') or os.environ.get('MYSQL_ADDON_HOST'),
        'user': os.environ.get('DB_USER') or os.environ.get('MYSQL_ADDON_USER'),
        'password': os.environ.get('DB_PASSWORD') or os.environ.get('MYSQL_ADDON_PASSWORD'),
        'database': os.environ.get('DB_NAME') or os.environ.get('MYSQL_ADDON_DB'),
        'port': int(os.environ.get('DB_PORT') or os.environ.get('MYSQL_ADDON_PORT') or 3306),
        'charset': 'utf8mb4',
        'connect_timeout': 10
    }

    # Redis (MateriaKV) Configuration
    REDIS_HOST = os.environ.get('REDIS_HOST')
    REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
    REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
