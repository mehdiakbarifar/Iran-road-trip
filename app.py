from flask import Flask, render_template, request, jsonify
from geopy.geocoders import Nominatim
import requests
import csv
import os

app = Flask(__name__)
geolocator = Nominatim(user_agent="iran_roadmap_app", timeout=10)

iran_cities = []
csv_file = 'ir.csv'
if os.path.exists(csv_file):
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            iran_cities.append(row['city'])

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_cities', methods=['GET'])
def get_cities():
    query = request.args.get('query', '').lower()
    suggestions = [city for city in iran_cities if query in city.lower()]
    return jsonify(suggestions[:10])

@app.route('/get_coordinates', methods=['POST'])
def get_coordinates():
    city = request.json.get('city')
    try:
        location = geolocator.geocode(f"{city}, Iran")
        if location:
            return jsonify({"lat": location.latitude, "lon": location.longitude})
        return jsonify({"error": "City not found"}), 404
    except Exception as e:
        return jsonify({"error": f"Geocoding failed: {str(e)}"}), 500

@app.route('/get_route', methods=['POST'])
def get_route():
    place1 = request.json.get('place1')
    place2 = request.json.get('place2')
    
    try:
        loc1 = geolocator.geocode(f"{place1}, Iran")
        loc2 = geolocator.geocode(f"{place2}, Iran")
        
        if not loc1 or not loc2:
            return jsonify({"error": "One or both cities not found"}), 404
        
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{loc1.longitude},{loc1.latitude};{loc2.longitude},{loc2.latitude}?overview=full&geometries=geojson"
        response = requests.get(osrm_url, timeout=10).json()
        
        if "routes" in response and response["routes"]:
            route = response["routes"][0]
            distance = route["distance"] / 1000
            duration = route["duration"] / 3600
            coordinates = route["geometry"]["coordinates"]
            return jsonify({
                "distance": round(distance, 2),
                "duration": round(duration, 2),
                "coordinates": coordinates
            })
        return jsonify({"error": "Route not found"}), 404
    except requests.Timeout:
        return jsonify({"error": "Route calculation timed out"}), 500
    except Exception as e:
        return jsonify({"error": f"Route calculation failed: {str(e)}"}), 500

@app.route('/add_city', methods=['POST'])
def add_city():
    data = request.json
    city_name = data.get('city')
    lat = data.get('lat')
    lon = data.get('lon')

    if not city_name or not lat or not lon:
        return jsonify({"error": "City name, latitude, and longitude are required"}), 400

    with open(csv_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['city', 'lat', 'lng', 'province'])
        if os.stat(csv_file).st_size == 0:
            writer.writeheader()
        writer.writerow({'city': city_name, 'lat': lat, 'lng': lon, 'province': ''})

    iran_cities.append(city_name)
    return jsonify({"message": f"City '{city_name}' added successfully"})

if __name__ == "__main__":
    app.run(debug=True)
