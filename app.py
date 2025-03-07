from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    import os
    port = int(os.getenv("PORT", 5000))  # Use PORT from Railway or default to 5000
    app.run(debug=False, host='0.0.0.0', port=port)