from flask import Flask, render_template, jsonify
import requests
import random

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')



@app.route("/api/quote")
def get_quote():
    """Fetches a random quote from the ZenQuotes API and returns JSON"""
    try:
        response = requests.get("https://zenquotes.io/api/quotes")
        response.raise_for_status()  # Raise error if request fails
        quotes = response.json()

        if isinstance(quotes, list) and len(quotes) > 0:
            random_quote = random.choice(quotes)  # Pick a random quote
            return jsonify({"quote": random_quote["q"], "author": random_quote["a"]})
        else:
            return jsonify({"error": "Invalid response from API"}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500




if __name__ == '__main__':
    import os
    port = int(os.getenv("PORT", 5000))  # Use PORT from Railway or default to 5000
    app.run(debug=False, host='0.0.0.0', port=port)