import pandas as pd

# Load the CSV file
file_path = 'ir.csv'  # Replace with the path to your file
data = pd.read_csv(file_path)

# Check for duplicate cities
duplicates = data[data.duplicated(subset=['city'], keep=False)]

if not duplicates.empty:
    print("Duplicate cities found:")
    print(duplicates)
else:
    print("No duplicate cities found.")
