import { useState, useRef } from 'react';
import { NiimbotBluetoothClient, NiimbotSerialClient, ImageEncoder } from '@mmote/niimbluelib';

function resolvePrintTask(client) {
  const detectedTask = client.getPrintTaskType();
  if (detectedTask) return detectedTask;

  const model = client.getModelMetadata()?.model;
  if (model === 'B21' || model === 'B21_L2B') return 'B21_V1';
  if (model === 'B21S' || model === 'B21S_C2B' || model === 'D110') return 'D110';
  if (model === 'B21_PRO' || model === 'B1_PRO') return 'D110M_V4';
  if (model === 'B21_C2B' || model === 'B1' || model === 'D110_M') return 'B1';
  return null;
}

export default function useLabelPrint() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting,  setIsPrinting]  = useState(false);
  const [error,       setError]       = useState('');
  const [printerMeta, setPrinterMeta] = useState(null);
  const [lastPrintMeta, setLastPrintMeta] = useState(null);
  const clientRef = useRef(null);
  const transportRef = useRef(null);

  async function connect(transport = 'bluetooth') {
    setError('');
    setLastPrintMeta(null);
    try {
      const client = transport === 'serial'
        ? new NiimbotSerialClient()
        : new NiimbotBluetoothClient();

      client.setPacketInterval(transport === 'serial' ? 4 : 10);
      client.setDebug(false);

      const connectionInfo = await client.connect();
      const info = client.getPrinterInfo();
      const model = client.getModelMetadata();

      client.on('disconnect', () => {
        setIsConnected(false);
        setPrinterMeta(null);
        clientRef.current = null;
        transportRef.current = null;
      });

      clientRef.current = client;
      transportRef.current = transport;
      setPrinterMeta({
        transport,
        deviceName: connectionInfo.deviceName || null,
        model: model?.model || null,
        modelId: info.modelId ?? null,
        protocolVersion: info.protocolVersion ?? null,
        taskType: resolvePrintTask(client),
        packetIntervalMs: transport === 'serial' ? 4 : 10,
      });
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
      transportRef.current = null;
      setPrinterMeta(null);
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
    const startedAt = performance.now();

    const PRINT_TIMEOUT = 20000; // 20 seconds
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الطباعة - تحقق من الطابعة')), PRINT_TIMEOUT)
    );

    try {
      await Promise.race([
        (async () => {
          const taskType = resolvePrintTask(client);
          if (!taskType) {
            throw new Error('تعذر تحديد نوع الطابعة أو بروتوكول الطباعة');
          }

          const printTask = client.abstraction.newPrintTask(taskType, {
            totalPages,
            density: 3,
            speed: 1,
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
      setLastPrintMeta({
        ok: true,
        transport: transportRef.current,
        durationMs: Math.round(performance.now() - startedAt),
        totalPages,
        copiesPerCanvas,
        taskType: resolvePrintTask(client),
      });
    } catch (e) {
      setError(e.message || 'فشل الطباعة');
      setLastPrintMeta({
        ok: false,
        transport: transportRef.current,
        durationMs: Math.round(performance.now() - startedAt),
        totalPages,
        copiesPerCanvas,
        taskType: resolvePrintTask(client),
        error: e.message || 'فشل الطباعة',
      });
    } finally {
      try { await client.abstraction?.printEnd(); } catch (_) {}
      setIsPrinting(false);
    }
  }

  return {
    connect,
    disconnect,
    print,
    printAll,
    isConnected,
    isPrinting,
    error,
    printerMeta,
    lastPrintMeta,
    transport: transportRef.current,
    supportsSerial: typeof navigator !== 'undefined' && 'serial' in navigator,
  };
}
