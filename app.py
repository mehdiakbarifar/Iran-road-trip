from flask import Flask, render_template, request, jsonify
import csv

app = Flask(__name__)

# Load cities from ir.csv
def load_cities():
    cities = {}
    with open('ir.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cities[row['city']] = {'lat': float(row['lat']), 'lng': float(row['lng'])}
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
        # Mock route data (replace with real routing logic)
        return jsonify({
            'coordinates': [
                [cities_data[place1]['lat'], cities_data[place1]['lng']],
                [cities_data[place2]['lat'], cities_data[place2]['lng']]
            ],
            'distance': 870,  # Placeholder distance
            'duration': 9.5   # Placeholder duration
        })
    return jsonify({'error': 'Invalid places'})

@app.route('/add_city', methods=['POST'])
def add_city():
    data = request.get_json()
    city = data.get('city')
    lat = data.get('lat')
    lng = data.get('lng')
    if city and lat and lng:
        # Add to cities_data (in-memory; persist to ir.csv if needed)
        cities_data[city] = {'lat': float(lat), 'lng': float(lng)}
        return jsonify({'message': f'Added {city}'})
    return jsonify({'error': 'Missing data'})

if __name__ == '__main__':
    app.run(debug=True)
