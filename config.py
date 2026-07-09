import os
from dotenv import load_dotenv

# Load local .env file if it exists (for local development)
load_dotenv()

class Config:
    # MySQL Database Configuration
    DB_CONFIG = {
        'host': os.environ.get('DB_HOST'),
        'user': os.environ.get('DB_USER'),
        'password': os.environ.get('DB_PASSWORD'),
        'database': os.environ.get('DB_NAME'),
        'charset': 'utf8mb4',
        'connect_timeout': 10
    }
