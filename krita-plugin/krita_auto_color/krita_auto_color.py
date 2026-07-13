from krita import Extension, Krita, ManagedColor
from PyQt5.QtCore import QHostAddress
from PyQt5.QtGui import QColor
from PyQt5.QtNetwork import QTcpServer
import json

PORT = 17491

class ManualImageDrawerAutoColor(Extension):
    def __init__(self, parent):
        super().__init__(parent)
        self.server = None
        self.buffers = {}

    def setup(self):
        self.server = QTcpServer(self)
        self.server.newConnection.connect(self.accept_connection)
        self.server.listen(QHostAddress.LocalHost, PORT)

    def createActions(self, window):
        pass

    def accept_connection(self):
        while self.server.hasPendingConnections():
            socket = self.server.nextPendingConnection()
            self.buffers[socket] = b''
            socket.readyRead.connect(lambda socket=socket: self.read_socket(socket))
            socket.disconnected.connect(lambda socket=socket: self.buffers.pop(socket, None))

    def read_socket(self, socket):
        self.buffers[socket] += bytes(socket.readAll())
        while b'\n' in self.buffers[socket]:
            line, remainder = self.buffers[socket].split(b'\n', 1)
            self.buffers[socket] = remainder
            try:
                payload = json.loads(line.decode('utf-8'))
                self.set_foreground_color(payload)
                socket.write(b'{"ok":true}\n')
                socket.flush()
            except Exception as error:
                socket.write(json.dumps({"ok": False, "error": str(error)}).encode('utf-8') + b'\n')
                socket.flush()

    def set_foreground_color(self, payload):
        red = max(0, min(255, int(payload.get('red', 0))))
        green = max(0, min(255, int(payload.get('green', 0))))
        blue = max(0, min(255, int(payload.get('blue', 0))))
        app = Krita.instance()
        window = app.activeWindow()
        if window is None:
            raise RuntimeError('No active Krita window')
        view = window.activeView()
        if view is None:
            raise RuntimeError('No active Krita view')
        color = ManagedColor.fromQColor(QColor(red, green, blue), view.canvas())
        view.setForeGroundColor(color)

Krita.instance().addExtension(ManualImageDrawerAutoColor(Krita.instance()))
