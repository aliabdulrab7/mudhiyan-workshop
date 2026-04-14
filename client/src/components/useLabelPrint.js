import { useState, useRef } from 'react';
import { NiimbotBluetoothClient, ImageEncoder } from '@mmote/niimbluelib';

export default function useLabelPrint() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting,  setIsPrinting]  = useState(false);
  const [error,       setError]       = useState('');
  const clientRef = useRef(null);

  async function connect() {
    setError('');
    try {
      const client = new NiimbotBluetoothClient();
      await client.connect();
      client.on('disconnect', () => { setIsConnected(false); clientRef.current = null; });
      await client.fetchPrinterInfo();
      clientRef.current = client;
      setIsConnected(true);
    } catch (e) {
      setError(e.message || 'فشل الاتصال بالطابعة');
    }
  }

  async function disconnect() {
    try {
      if (clientRef.current) await clientRef.current.disconnect();
    } catch (e) {
      console.error('Disconnect error', e);
    } finally {
      clientRef.current = null;
      setIsConnected(false);
    }
  }

  // Print a single canvas (kept for backward compatibility)
  async function print(canvas) {
    return printAll([canvas]);
  }

  // Print multiple canvases sequentially in one Bluetooth session
  async function printAll(canvases) {
    const client = clientRef.current;
    if (!client) { setError('غير متصل بالطابعة'); return; }

    setIsPrinting(true);
    setError('');

    try {
      // Auto-detect the correct print task for the connected printer model.
      // B21S uses 'D110', B21 uses 'B21_V1' — getPrintTaskType() resolves this.
      const taskType = client.getPrintTaskType() ?? 'D110';
      const printTask = client.abstraction.newPrintTask(taskType, {
        totalPages: canvases.length,
        density: 3,
      });
      await printTask.printInit();

      for (const canvas of canvases) {
        const encoded = ImageEncoder.encodeCanvas(canvas, 'top');
        await printTask.printPage(encoded, 1);
        await printTask.waitForPageFinished();
      }

      await printTask.waitForFinished();
    } catch (e) {
      setError(e.message || 'فشل الطباعة');
    } finally {
      try { await client.abstraction?.printEnd(); } catch (_) {}
      setIsPrinting(false);
    }
  }

  return { connect, disconnect, print, printAll, isConnected, isPrinting, error };
}
