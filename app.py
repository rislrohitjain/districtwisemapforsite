from flask import Flask, render_template, jsonify
import pymysql
from decimal import Decimal
import logging
from config import Config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Mock data fallback for when the database is unreachable (e.g. on public Vercel/HuggingFace instances)
MOCK_SCHOOLS = [
    {"id": 1, "name": "Govt. Senior Sec. School, Anupgarh Town", "district": "Anupgarh", "latitude": 29.191244, "longitude": 73.212567, "center_code": "a1001"},
    {"id": 2, "name": "Govt. Senior Secondary School, Multipurpose Sri Ganganagar", "district": "Sri Ganganagar", "latitude": 29.914289, "longitude": 73.871452, "center_code": "b2550"},
    {"id": 3, "name": "Govt. Senior Secondary School, Jaalwali", "district": "Sri Ganganagar", "latitude": 29.621455, "longitude": 73.704123, "center_code": "c1003"},
    {"id": 4, "name": "Govt. Mahatma Gandhi School, Jaipur Central", "district": "Jaipur", "latitude": 26.912433, "longitude": 75.787271, "center_code": "d1004"},
    {"id": 5, "name": "Govt. Girls Sr. Sec. School, Adarsh Nagar", "district": "Jaipur", "latitude": 26.899212, "longitude": 75.820155, "center_code": "e1005"},
    {"id": 6, "name": "Govt. Sr. Sec. School, Mandore Fort", "district": "Jodhpur", "latitude": 26.340899, "longitude": 73.044888, "center_code": "f1006"},
    {"id": 7, "name": "Govt. Secondary School, Sardarpura", "district": "Jodhpur", "latitude": 26.289122, "longitude": 73.011762, "center_code": "g1007"},
    {"id": 8, "name": "Govt. Sr. Sec. School, Jagdish Temple", "district": "Udaipur", "latitude": 24.579601, "longitude": 73.684422, "center_code": "h1008"},
    {"id": 9, "name": "Govt. Girls Secondary School, Hiran Magri", "district": "Udaipur", "latitude": 24.558312, "longitude": 73.712134, "center_code": "i1009"},
    {"id": 10, "name": "Govt. Secondary School, Bikaner City", "district": "Bikaner", "latitude": 28.016711, "longitude": 73.311745, "center_code": "j1010"},
    {"id": 11, "name": "Govt. Girls Sr. Sec. School, Bikaner Station", "district": "Bikaner", "latitude": 28.022340, "longitude": 73.321098, "center_code": "k1011"},
    {"id": 12, "name": "Govt. Senior Secondary School, Ajmer Clock Tower", "district": "Ajmer", "latitude": 26.449895, "longitude": 74.639731, "center_code": "l1012"},
    {"id": 13, "name": "Govt. Sr. Sec. School, Pushkar Road", "district": "Ajmer", "latitude": 26.478912, "longitude": 74.612349, "center_code": "m1013"},
    {"id": 14, "name": "Govt. Secondary School, Kota Junction", "district": "Kota", "latitude": 25.213890, "longitude": 75.864120, "center_code": "n1014"},
    {"id": 15, "name": "Govt. Sr. Sec. School, Dadabari", "district": "Kota", "latitude": 25.151240, "longitude": 75.823901, "center_code": "o1015"}
]

def get_db_connection():
    return pymysql.connect(**app.config['DB_CONFIG'])

@app.route('/')
def index():
    # Renders the dashboard page (no Maps key parameter required)
    return render_template('index.html')

@app.route('/api/schools')
def api_schools():
    try:
        conn = get_db_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, district, latitude, longitude, center_code FROM schools")
            schools = cursor.fetchall()
            
            # Format Decimals into standard float numbers
            for school in schools:
                if isinstance(school['latitude'], Decimal):
                    school['latitude'] = float(school['latitude'])
                if isinstance(school['longitude'], Decimal):
                    school['longitude'] = float(school['longitude'])
                    
        conn.close()

        return jsonify({
            "status": "success", 
            "data": schools, 
            "source": "database"
        })
    except Exception as e:
        logger.warning(f"Database connection failed: {e}. Falling back to mock data.")
        return jsonify({
            "status": "success", 
            "data": MOCK_SCHOOLS, 
            "source": "mock_fallback", 
            "warning": "Database offline. Displaying local mock data."
        })

@app.route('/api/stats')
def api_stats():
    try:
        conn = get_db_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT district, COUNT(*) as count 
                FROM schools 
                GROUP BY district 
                ORDER BY count DESC
            """)
            stats = cursor.fetchall()
        conn.close()
        return jsonify({
            "status": "success", 
            "data": stats, 
            "source": "database"
        })
    except Exception as e:
        mock_stats_dict = {}
        for school in MOCK_SCHOOLS:
            dist = school["district"]
            mock_stats_dict[dist] = mock_stats_dict.get(dist, 0) + 1
            
        mock_stats = [
            {"district": dist, "count": count} 
            for dist, count in sorted(mock_stats_dict.items(), key=lambda x: x[1], reverse=True)
        ]
        
        return jsonify({
            "status": "success", 
            "data": mock_stats, 
            "source": "mock_fallback"
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
