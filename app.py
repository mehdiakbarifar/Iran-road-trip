from flask import Flask, render_template, request, jsonify
import csv
import requests

app = Flask(__name__)

# Load cities from ir.csv with correct headers (city, lat, lng)
def load_cities():
    cities = {}
    with open('ir.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cities[row['city']] = {'lat': float(row['lat']), 'lon': float(row['lng'])}
    return cities

cities_data = load_cities()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_cities')
def get_cities():
    query = request.args.get('query', '').lower()
    matching_cities = [city for city in cities_data.keys() if query in city.lower()]
    return jsonify(matching_cities)

@app.route('/get_coordinates', methods=['POST'])
def get_coordinates():
    data = request.get_json()
    city = data.get('city', '')
    coords = cities_data.get(city)
    if coords:
        return jsonify(coords)
    return jsonify({'error': 'City not found'})

@app.route('/get_route', methods=['POST'])
def get_route():
    data = request.get_json()
    place1 = data.get('place1', '')
    place2 = data.get('place2', '')
    if place1 in cities_data and place2 in cities_data:
        # Use OSRM for real routing
        coords1 = [cities_data[place1]['lon'], cities_data[place1]['lat']]
        coords2 = [cities_data[place2]['lon'], cities_data[place2]['lat']]
        
        url = f"http://router.project-osrm.org/route/v1/driving/{coords1[0]},{coords1[1]};{coords2[0]},{coords2[1]}?overview=full&geometries=geojson"
        response = requests.get(url)
        route_data = response.json()
        
        if 'routes' in route_data and route_data['routes']:
            coordinates = route_data['routes'][0]['geometry']['coordinates']
            distance = route_data['routes'][0]['distance'] / 1000  # Convert to km
            duration = route_data['routes'][0]['duration'] / 3600  # Convert to hours
            return jsonify({
                'coordinates': coordinates,
                'distance': distance,
                'duration': duration
            })
        else:
            return jsonify({'error': 'No route found'})
    
    return jsonify({'error': 'Invalid places'})

@app.route('/add_city', methods=['POST'])
def add_city():
    data = request.get_json()
    city = data.get('city')
    lat = data.get('lat')
    lon = data.get('lon')
    if city and lat and lon:
        # Add to cities_data (in-memory)
        cities_data[city] = {'lat': float(lat), 'lon': float(lon)}
        # Append to ir.csv with correct headers
        with open('ir.csv', 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([city, lat, lon, 'Iran', 'IR', '', '', ''])
        return jsonify({'message': f'Added {city}'})
    return jsonify({'error': 'Missing data'})

if __name__ == '__main__':
    # Get the port from the environment variable or use 5000 as a default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

