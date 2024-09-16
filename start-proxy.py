import socket
import threading
import logging
import colorlog
import select

handler = colorlog.StreamHandler()
handler.setFormatter(colorlog.ColoredFormatter(
    '%(log_color)s%(asctime)s - %(levelname)s - %(message)s',
    log_colors={
        'DEBUG': 'cyan',
        'INFO': 'green',
        'WARNING': 'yellow',
        'ERROR': 'red',
        'CRITICAL': 'red,bg_white',
    }
))

logger = colorlog.getLogger()
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

def handle_client(client_socket):
    try:
        request = client_socket.recv(1024)
        logger.info(f"Получен запрос: {request[:50]}...")

        first_line = request.split(b'\n')[0]
        method, url, version = first_line.split()

        if method == b'CONNECT':
            handle_connect(client_socket, url)
        else:
            handle_http(client_socket, request)

    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {e}")
    finally:
        client_socket.close()

def handle_connect(client_socket, url):
    host, port = url.split(b':')
    try:
        server_socket = socket.create_connection((host, int(port)))
        client_socket.sendall(b'HTTP/1.1 200 Connection Established\r\n\r\n')
        
        forward_thread = threading.Thread(target=forward, args=(client_socket, server_socket))
        backward_thread = threading.Thread(target=forward, args=(server_socket, client_socket))
        
        forward_thread.start()
        backward_thread.start()
        
        forward_thread.join()
        backward_thread.join()
        
    except Exception as e:
        logger.error(f"Ошибка при установлении CONNECT-туннеля: {e}")
    finally:
        client_socket.close()
        server_socket.close()

def forward(source, destination):
    try:
        while True:
            read, _, _ = select.select([source], [], [], 1)
            if read:
                data = source.recv(4096)
                if not data:
                    break
                destination.sendall(data)
    except Exception as e:
        logger.error(f"Ошибка при пересылке данных: {e}")

def handle_http(client_socket, request):
    # Обработка обычных HTTP-запросов (если нужно)
    pass

def start_proxy(host='0.0.0.0', port=2509):
    proxy_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    proxy_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        proxy_socket.bind((host, port))
        proxy_socket.listen(10)
        logger.info(f"Прокси-сервер запущен на {host}:{port}")

        while True:
            client_socket, addr = proxy_socket.accept()
            logger.info(f"Получено соединение от {addr}")
            client_thread = threading.Thread(target=handle_client, args=(client_socket,))
            client_thread.start()
    except Exception as e:
        logger.error(f"Ошибка при запуске прокси-сервера: {e}")
    finally:
        proxy_socket.close()

if __name__ == "__main__":
    start_proxy()