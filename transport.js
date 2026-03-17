(function () {
    class LedTransport {
        async connect() {
            throw new Error("connect() not implemented");
        }

        async sendFrame(_frame) {
            throw new Error("sendFrame() not implemented");
        }

        async disconnect() {
            throw new Error("disconnect() not implemented");
        }
    }

    class MockTransport extends LedTransport {
        constructor() {
            super();
            this.connected = false;
            this.lastFrame = [];
        }

        async connect() {
            this.connected = true;
            return true;
        }

        async sendFrame(frame) {
            if (!this.connected) return;
            this.lastFrame = Array.isArray(frame) ? [...frame] : [];
        }

        async disconnect() {
            this.connected = false;
        }
    }

    class WebSerialTransport extends LedTransport {
        constructor({ baudRate = 115200 } = {}) {
            super();
            this.baudRate = baudRate;
            this.port = null;
            this.writer = null;
            this.textEncoder = new TextEncoder();
        }

        async connect() {
            if (!("serial" in navigator)) {
                throw new Error("WebSerial non supporte par ce navigateur.");
            }
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: this.baudRate });
            this.writer = this.port.writable.getWriter();
            return true;
        }

        async sendFrame(frame) {
            if (!this.writer) return;
            const payload = JSON.stringify({ type: "frame", leds: frame });
            await this.writer.write(this.textEncoder.encode(payload + "\n"));
        }

        async disconnect() {
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
        }
    }

    function createTransport(kind = "mock") {
        if (kind === "webserial") return new WebSerialTransport();
        return new MockTransport();
    }

    window.CoreLightTransport = {
        LedTransport,
        MockTransport,
        WebSerialTransport,
        createTransport,
    };
})();
