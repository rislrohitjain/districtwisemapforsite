import time
import urllib.request
import urllib.parse
import json
import random
import pymysql
from config import Config

# List of schools to insert provided by the user
SCHOOLS_TO_INSERT = [
    ('Govt. Senior Sec. School, Anupgarh', 'Anupgarh'),
    ('Govt. Senior Secondary School,Multipurpose Sri Ganganagar', 'Sri Ganganagar'),
    ('Govt. Senior Secondary School 1Mlk-C Jaalwali (212115)', 'Sri Ganganagar'),
    ('Govt. Senior Sec. School, Shrikaranpur', 'Sri Ganganagar'),
    ('Shahid Kaiptan En. Es. Es. Govt. Senior Sec. School Padampur', 'Sri Ganganagar'),
    ('Govt. Senior Sec. School, Compulsory Raisinghnagar', 'Sri Ganganagar'),
    ('Bhopalavala Ary. Senior Sec. School, Shriganganagar', 'Sri Ganganagar'),
    ('Govt. Senior Sec. School, Suratgarh', 'Sri Ganganagar'),
    ('SHREE GURUSHARAN CHHABRA GOVT.SR.SEC.SCHOOL PURANI ABADI SURATGARH  SRI GANGANAGAR', 'Sri Ganganagar'),
    ('Govt. Senior Secondary School Karadwali Eight Np (212170)', 'Sri Ganganagar'),
    ('Govt. Senior Sec. School, Bhadra, Hanumanagarh', 'Hanumangarh'),
    ('Govt. Senior Sec. School, Hanumangarh Town (Fort)', 'Hanumangarh'),
    ('Govt. Senior Sec. School, Nohar, Hanumanagarh', 'Hanumangarh'),
    ('G..S.S.S PILIBANGA', 'Hanumangarh'),
    ('Govt.Sr.Sec. School Rawatsar', 'Hanumangarh'),
    ('Govt.Sr.Sec. school Sangaria', 'Hanumangarh'),
    ('Govt. Senior Sec. School talwara jhil', 'Hanumangarh'),
    ('Govt. Chopra . Senior Sec. School,Bikaner', 'Bikaner'),
    ('Shaheed Om Prakash bishnoi Govt.sr.sec.School Khajuwala Bikaner', 'Bikaner'),
    ('Government Senior Secondary School Hadan Kolayat', 'Bikaner'),
    ('Govt. Senior Sec. School, Loonkaransar', 'Bikaner'),
    ('Govt. Baba Chhotunath Ji Senior Sec. School,Nokha', 'Bikaner'),
    ('Govt Sr. Sec school  Panchu', 'Bikaner'),
    ('Govt. Senior Sec. School, Shri Doongaragarh, Bikaner', 'Bikaner'),
    ('Government Girls Senior Secondary School Bajju Khalsa', 'Bikaner'),
    ('Government Senior Secondary School 2ADM', 'Bikaner'),
    ('Seth Dulichand Sethiya Govt. se.sec.school ward.09 Bidasar', 'Churu'),
    ('Govt. Bagala Senior Sec. School, Churu (Nodal Kendra)', 'Churu'),
    ('Govt. Senior Sec. School, Rajgarh, Churu', 'Churu'),
    ('Government Girls Senior Secondary School Padihara', 'Churu'),
    ('Govt. P.C.B. Senior Sec. School, Sujangarh, Churu', 'Churu'),
    ('Govt. Senior Sec. School, Taranagar, Churu', 'Churu'),
    ('Govt. Senior Sec. School, Buhana', 'Jhunjhunu'),
    ('Shahid Karnal Je. Pi. Jnoo Govt. Senior Sec. School, Jhunjhunu (Nodal Kendra)', 'Jhunjhunu'),
    ('Govt. Jyasinh Senior Sec. School, Khetdi', 'Jhunjhunu'),
    ('Smt.Teeja devi more Govt.girls. sec.sr.School Nawalgarh', 'Jhunjhunu'),
    ('Govt. Senior Sec. School, Udaipurwati, Jhunjhunu', 'Jhunjhunu'),
    ('Govt. Senior Secondary School Kharkada Devran (215959)', 'Jhunjhunu'),
    ('Govt.Sec.School Bajawa SuronKa', 'Jhunjhunu'),
    ('Mahatma Gandhi Government School, Singhana', 'Jhunjhunu'),
    ('Govt. Senior Secondary School Bankoti (215971)', 'Jhunjhunu'),
    ('Govt. Senior Secondary School Ranwa (215999)', 'Jhunjhunu'),
    ('Govt. Senior Sec. School, Bansur, Alwar', 'Alwar'),
    ('Govt. Senior Sec. School, Baharor, Alwar', 'Alwar'),
    ('Govt. Yashavant Senior Sec. School, Alwar', 'Alwar'),
    ('Govt. Senior Sec. School, Kishanagarhabas, Alwar', 'Alwar'),
    ('Govt.sec.sr.school kotkasim', 'Alwar'),
    ('Govt. Senior Sec. School, Laxmangarh Alwar', 'Alwar'),
    ('Govt. Senior Sec. School, Mundawar, Alwar', 'Alwar')
]

# Coordinate Fallbacks in case geocoding fails or is throttled
DISTRICT_COORDS = {
    'Anupgarh': (29.1912, 73.2126),
    'Sri Ganganagar': (29.9143, 73.8715),
    'Hanumangarh': (29.5800, 74.3200),
    'Bikaner': (28.0167, 73.3117),
    'Churu': (28.2900, 74.9600),
    'Jhunjhunu': (28.1300, 75.4000),
    'Alwar': (27.5600, 76.6000),
}

def geocode_district(district_name):
    # Geocodes district center coordinates using Nominatim API
    query = f"{district_name}, Rajasthan, India"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1
    })
    req = urllib.request.Request(url, headers={'User-Agent': 'LRSOSGeocodePopulator/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read())
            if res:
                lat = float(res[0]['lat'])
                lng = float(res[0]['lon'])
                print(f"Geocoded {district_name} successfully: ({lat}, {lng})")
                return lat, lng
    except Exception as e:
        print(f"Could not geocode {district_name}: {e}. Using fallback coordinates.")
    return DISTRICT_COORDS.get(district_name, (26.5500, 74.9000))

def main():
    # 1. Geocode all unique districts
    unique_districts = set(d for _, d in SCHOOLS_TO_INSERT)
    district_map = {}
    for dist in unique_districts:
        district_map[dist] = geocode_district(dist)
        time.sleep(1.2) # Delay to respect Nominatim usage policy
        
    # 2. Add coordinates to schools with jitter
    prepared_schools = []
    for name, dist in SCHOOLS_TO_INSERT:
        base_lat, base_lng = district_map.get(dist, (26.55, 74.90))
        # Add random scatter so markers do not overlay exactly
        jitter_lat = base_lat + random.uniform(-0.05, 0.05)
        jitter_lng = base_lng + random.uniform(-0.05, 0.05)
        center_code = f"{random.choice('abcdefghijklmnopqrstuvwxyz')}{random.randint(1000, 9999)}"
        prepared_schools.append((name, dist, jitter_lat, jitter_lng, center_code))

    # 3. Write to MySQL DB
    print("Connecting to database...")
    try:
        conn = pymysql.connect(**Config.DB_CONFIG)
        cur = conn.cursor()
        
        print("Truncating schools table...")
        cur.execute("TRUNCATE TABLE schools")
        
        print("Inserting records...")
        sql = "INSERT INTO schools (name, district, latitude, longitude, center_code) VALUES (%s, %s, %s, %s, %s)"
        cur.executemany(sql, prepared_schools)
        conn.commit()
        print(f"Successfully populated {cur.rowcount} schools.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print("Database operation failed:", e)

if __name__ == '__main__':
    main()
