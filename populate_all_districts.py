import os
import re
import time
import urllib.request
import urllib.parse
import json
import random
import pymysql
from config import Config

# Complete list of 44 districts requested by the user
DISTRICTS = [
    'Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 
    'Bundi', 'Chittorgarh', 'Churu', 'Dungarpur', 'Jaipur', 'Jaisalmer', 'Jalore', 
    'Jhunjhunu', 'Jhalawar', 'Jodhpur', 'Kota', 'Nagaur', 'Pali', 'Sawaimadhopur', 
    'Sikar', 'Sirohi', 'Tonk', 'Udaipur', 'Dholpur', 'Dausa', 'Baran', 'Rajsamand', 
    'Hanumangarh', 'Karauli', 'Pratapgarh', 'Anupgarh', 'Balotra', 'Beawar', 'Didwana', 
    'Kuchaman', 'Deeg', 'Gangapur', 'Kekri', 'Salumbar', 'Shahpura', 'Khairthal', 'Kotputli'
]

# Town/Sub-district mappings
MAPPING_ALIASES = {
    'beawer': 'Beawar', 'beawar': 'Beawar', 'barakhan': 'Beawar', 'jawaja': 'Beawar',
    'balotara': 'Balotra', 'balotra': 'Balotra', 'jasol': 'Balotra',
    'sedwa': 'Barmer', 'bayatu': 'Barmer', 'sindhari': 'Barmer', 'chauhatan': 'Barmer', 'dhaurimanna': 'Barmer',
    'khajuwala': 'Bikaner', 'kolayat': 'Bikaner', 'nokha': 'Bikaner', 'panchu': 'Bikaner', 'doongaragarh': 'Bikaner',
    'bidasar': 'Churu', 'sujangarh': 'Churu', 'taranagar': 'Churu', 'saradarashahar': 'Churu', 'ratangarh': 'Churu',
    'nawalgarh': 'Jhunjhunu', 'chirawa': 'Jhunjhunu', 'buhana': 'Jhunjhunu', 'khetdi': 'Jhunjhunu', 'singhana': 'Jhunjhunu',
    'bansur': 'Alwar', 'baharor': 'Alwar', 'ramgarh': 'Alwar', 'rajgarh': 'Alwar', 'laxmangarh': 'Alwar',
    'tijara': 'Alwar', 'mundawar': 'Alwar', 'kotkasim': 'Alwar', 'kishanagarhabas': 'Alwar', 'govindgarh': 'Alwar',
    'bagidora': 'Banswara', 'anandpuri': 'Banswara', 'arthuna': 'Banswara', 'talwara': 'Banswara', 'garhi': 'Banswara',
    'bayana': 'Bharatpur', 'vair': 'Bharatpur', 'nadbai': 'Bharatpur', 'kama': 'Bharatpur', 'pahari': 'Bharatpur',
    'asind': 'Bhilwara', 'mandalgarh': 'Bhilwara', 'mandal': 'Bhilwara', 'hurda': 'Bhilwara', 'bijoliya': 'Bhilwara',
    'raipur': 'Bhilwara', 'kareda': 'Bhilwara', 'badanor': 'Bhilwara',
    'sagwara': 'Dungarpur', 'dhambola': 'Dungarpur', 'sabla': 'Dungarpur', 'simalavada': 'Dungarpur',
    'sanganer': 'Jaipur', 'amer': 'Jaipur', 'viratnagar': 'Jaipur', 'kotaputali': 'Jaipur', 'chaksu': 'Jaipur',
    'shahpura': 'Jaipur', 'bassi': 'Jaipur', 'jhotawara': 'Jaipur', 'chomu': 'Jaipur', 'jamuvaramagarh': 'Jaipur',
    'fulera': 'Jaipur', 'jamavaramagarh': 'Jaipur', 'kotkhawada': 'Jaipur', 'jalsu': 'Jaipur', 'dudoo': 'Jaipur',
    'pokaran': 'Jaisalmer',
    'sayala': 'Jalore', 'bhinaral': 'Jalore', 'bhinamal': 'Jalore', 'ahor': 'Jalore',
    'manoharathana': 'Jhalawar', 'dag': 'Jhalawar', 'khanpur': 'Jhalawar', 'jhalarapatan': 'Jhalawar', 'bakani': 'Jhalawar',
    'pidava': 'Jhalawar', 'akalera': 'Jhalawar', 'bhavani': 'Jhalawar',
    'falodi': 'Jodhpur', 'lohavat': 'Jodhpur', 'osiyan': 'Jodhpur', 'sheragarh': 'Jodhpur', 'looni': 'Jodhpur',
    'dechu': 'Jodhpur', 'mandore': 'Jodhpur', 'bap': 'Jodhpur', 'ghantiyali': 'Jodhpur', 'kanasar': 'Jodhpur',
    'jamba': 'Jodhpur', 'falaudi': 'Jodhpur', 'bamanu': 'Jodhpur', 'kolu pabuji': 'Jodhpur',
    'gumanpura': 'Kota', 'bhimganjmandi': 'Kota', 'ladpura': 'Kota', 'sultanpur': 'Kota', 'itava': 'Kota',
    'ramganjmandi': 'Kota', 'sangod': 'Kota',
    'riyabadi': 'Nagaur', 'makrana': 'Nagaur', 'didwana': 'Didwana', 'kuchaman': 'Kuchaman', 'ladnoon': 'Nagaur',
    'degana': 'Nagaur', 'jayal': 'Nagaur', 'nawa': 'Nagaur', 'parbatsar': 'Nagaur', 'maulasar': 'Nagaur',
    'rohat': 'Pali', 'desuri': 'Pali', 'jaitaran': 'Pali', 'sojat': 'Pali', 'rani': 'Pali', 'sumerpur': 'Pali',
    'bali': 'Pali', 'sadri': 'Pali',
    'nadauti': 'Karauli', 'bamanavas': 'Sawaimadhopur'
}

# Coordinate Fallbacks
DISTRICT_COORDS = {
    'Ajmer': (26.4499, 74.6397), 'Alwar': (27.5600, 76.6000), 'Banswara': (23.5500, 74.4500),
    'Barmer': (25.7500, 71.4000), 'Bharatpur': (27.2170, 77.4900), 'Bhilwara': (25.3500, 74.6300),
    'Bikaner': (28.0167, 73.3117), 'Bundi': (25.4400, 75.6400), 'Chittorgarh': (24.8800, 74.6200),
    'Churu': (28.2900, 74.9600), 'Dungarpur': (23.8400, 73.7200), 'Jaipur': (26.9124, 75.7873),
    'Jaisalmer': (26.9157, 70.9083), 'Jalore': (25.3500, 72.6300), 'Jhunjhunu': (28.1300, 75.4000),
    'Jhalawar': (24.6000, 76.1500), 'Jodhpur': (26.2743, 73.0243), 'Kota': (25.1800, 75.8300),
    'Nagaur': (27.2000, 73.7300), 'Pali': (25.7700, 73.3300), 'Sawaimadhopur': (25.9800, 76.3800),
    'Sikar': (27.6200, 75.1500), 'Sirohi': (24.8800, 72.8500), 'Tonk': (26.1600, 75.7800),
    'Udaipur': (24.5800, 73.7100), 'Dholpur': (26.7000, 77.9000), 'Dausa': (26.8800, 76.3300),
    'Baran': (25.1000, 76.5000), 'Rajsamand': (25.0700, 73.8800), 'Hanumangarh': (29.5800, 74.3200),
    'Karauli': (26.5000, 77.0200), 'Pratapgarh': (24.0300, 74.7800), 'Anupgarh': (29.1912, 73.2126),
    'Balotra': (25.8300, 72.2300), 'Beawar': (26.1000, 74.3200), 'Didwana': (27.4000, 74.5700),
    'Kuchaman': (27.1500, 74.8621), 'Deeg': (27.4700, 77.3300), 'Gangapur': (26.4700, 76.7200),
    'Kekri': (25.9700, 75.1500), 'Salumbar': (24.1300, 74.0400), 'Shahpura': (25.6300, 74.9300),
    'Khairthal': (27.8000, 76.6300), 'Kotputli': (27.7000, 76.2000), 'Sawai Madhopur': (25.9800, 76.3800)
}

def get_school_district(school_name):
    name = school_name.lower()
    
    # 1. Direct match on districts
    for dist in DISTRICTS:
        if dist.lower() in name:
            return dist
            
    # 2. Match on aliases
    for alias, dist in MAPPING_ALIASES.items():
        if alias in name:
            return dist
            
    return 'Jaipur' # Default fallback district

def geocode_district(district_name):
    query = f"{district_name}, Rajasthan, India"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1
    })
    req = urllib.request.Request(url, headers={'User-Agent': 'LRSOSAllDistrictsGeocodePopulator/1.0'})
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
    filename = 'temp_schools_new.txt'
    if not os.path.exists(filename):
        print(f"Error: {filename} not found.")
        return
        
    with open(filename, 'r', encoding='utf-8') as f:
        text = f.read()
        
    matches = re.findall(r'"([^"\n]+)"', text)
    real_schools = [m for m in matches if m != "college_name"]
    
    print(f"Extracted {len(real_schools)} real schools from chat logs.")
    
    # Initialize dictionary for schools in each district
    schools_by_district = {d: [] for d in DISTRICTS}
    
    # Map real schools to districts
    for school in real_schools:
        dist = get_school_district(school)
        schools_by_district[dist].append(school)
        
    # For any district that currently has 0 schools, generate 2 mock schools
    for dist in DISTRICTS:
        if len(schools_by_district[dist]) == 0:
            schools_by_district[dist].append(f"Govt. Senior Sec. School, {dist}")
            schools_by_district[dist].append(f"Govt. Girls Senior Sec. School, {dist}")
            
    # Geocode all 44 districts
    print("Geocoding all 44 districts...")
    district_map = {}
    for dist in DISTRICTS:
        district_map[dist] = geocode_district(dist)
        time.sleep(1.2) # Sleep to respect Nominatim usage limits
        
    # Prepare database records with jitter offset
    prepared_records = []
    total_schools = 0
    for dist, schools in schools_by_district.items():
        base_lat, base_lng = district_map.get(dist, (26.55, 74.90))
        for school in schools:
            jitter_lat = base_lat + random.uniform(-0.06, 0.06)
            jitter_lng = base_lng + random.uniform(-0.06, 0.06)
            center_code = f"{random.choice('abcdefghijklmnopqrstuvwxyz')}{random.randint(1000, 9999)}"
            prepared_records.append((school, dist, jitter_lat, jitter_lng, center_code))
            total_schools += 1
            
    print(f"Prepared {total_schools} total records across {len(DISTRICTS)} districts.")
    
    # Reload database
    print("Connecting to database...")
    try:
        conn = pymysql.connect(**Config.DB_CONFIG)
        cur = conn.cursor()
        
        print("Creating schools table if not exists...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schools (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                district VARCHAR(100) NOT NULL,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                center_code VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()
        
        print("Truncating schools table...")
        cur.execute("TRUNCATE TABLE schools")
        
        print("Inserting records...")
        sql = "INSERT INTO schools (name, district, latitude, longitude, center_code) VALUES (%s, %s, %s, %s, %s)"
        cur.executemany(sql, prepared_records)
        conn.commit()
        print(f"Success! Truncated and populated {cur.rowcount} schools across all districts.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print("Database operation failed:", e)

if __name__ == '__main__':
    main()
