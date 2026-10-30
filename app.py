import os

from flask import Flask

from db.entity.api import bp

app = Flask(__name__, static_folder= "UI", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "das_ist_ein_lokaler_test")
app.register_blueprint(bp)
@app.route("/")
def index():
    return app.send_static_file("Login.html")
