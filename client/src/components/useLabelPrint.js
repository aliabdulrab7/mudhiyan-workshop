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
  async function printAll(canvases, options = {}) {
    const client = clientRef.current;
    if (!client) { setError('غير متصل بالطابعة'); return; }

    const copiesPerCanvas = Math.max(1, Number(options.copiesPerCanvas) || 1);
    const maxLabels = options.maxLabels == null ? Infinity : Math.max(1, Number(options.maxLabels) || 1);
    const printableCanvases = canvases.filter(Boolean).slice(0, maxLabels);
    const totalPages = printableCanvases.length * copiesPerCanvas;

    if (totalPages === 0) {
      setError('لا توجد ملصقات صالحة للطباعة');
      return;
    }

    setIsPrinting(true);
    setError('');

    const PRINT_TIMEOUT = 20000; // 20 seconds
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الطباعة - تحقق من الطابعة')), PRINT_TIMEOUT)
    );

    try {
      await Promise.race([
        (async () => {
          const taskType = client.getPrintTaskType() ?? 'D110';
          const printTask = client.abstraction.newPrintTask(taskType, {
            totalPages,
            density: 3,
          });
          await printTask.printInit();

          for (const canvas of printableCanvases) {
            const encoded = ImageEncoder.encodeCanvas(canvas, 'top');
            await printTask.printPage(encoded, copiesPerCanvas);
            await printTask.waitForPageFinished();
          }

          await printTask.waitForFinished();
        })(),
        timeoutPromise
      ]);
    } catch (e) {
      setError(e.message || 'فشل الطباعة');
      // If error or timeout, we should probably suggest a reset
    } finally {
      try { await client.abstraction?.printEnd(); } catch (_) {}
      setIsPrinting(false);
    }
  }

  return { connect, disconnect, print, printAll, isConnected, isPrinting, error };
}
