import { useState, useRef } from 'react';
import { NiimbotBluetoothClient, ImageEncoder } from '@mmote/niimbluelib';

export default function useLabelPrint() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState('');
  const clientRef = useRef(null);

  async function connect() {
    setError('');
    try {
      const client = new NiimbotBluetoothClient();
      await client.connect();

      client.on('disconnect', () => {
        setIsConnected(false);
        clientRef.current = null;
      });

      await client.fetchPrinterInfo();
      clientRef.current = client;
      setIsConnected(true);
    } catch (e) {
      setError(e.message || 'فشل الاتصال بالطابعة');
    }
  }

  // Fix #14: error handling + always reset state in finally
  async function disconnect() {
    try {
      if (clientRef.current) {
        await clientRef.current.disconnect();
      }
    } catch (e) {
      console.error('Disconnect error', e);
    } finally {
      clientRef.current = null;
      setIsConnected(false);
    }
  }

  async function print(canvas) {
    // Fix #6: capture client reference before any await
    const client = clientRef.current;
    if (!client) {
      setError('غير متصل بالطابعة');
      return;
    }

    setIsPrinting(true);
    setError('');

    try {
      const quantity = 1;
      const encoded = ImageEncoder.encodeCanvas(canvas, 'left');

      const printTask = client.abstraction.newPrintTask('B21_V1', {
        totalPages: quantity,
        density: 3,
      });

      await printTask.printInit();
      await printTask.printPage(encoded, quantity);
      await printTask.waitForPageFinished();
      await printTask.waitForFinished();
    } catch (e) {
      setError(e.message || 'فشل الطباعة');
    } finally {
      // Fix #6: use captured `client`, not clientRef.current (may be null after disconnect event)
      try { await client.abstraction?.printEnd(); } catch (_) {}
      setIsPrinting(false);
    }
  }

  return { connect, disconnect, print, isConnected, isPrinting, error };
}
