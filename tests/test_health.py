from backend.app.main import health_check, root

def test_health_check():
    response = health_check()
    assert response["status"] == "ok"
    assert response["service"] == "veriguard-ai"

def test_root():
    response = root()
    assert "message" in response
