import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import mdns from "multicast-dns";
import fs from "fs/promises";
import { existsSync } from "fs";
import os from "os";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");

async function startServer() {
  console.log("🚢 Starting Bunker Watch Server...");
  console.log("Node version:", process.version);
  console.log("Environment:", process.env.NODE_ENV);
  
  const app = express();
  const PORT = 3000;

  // Ensure data file exists
  try {
    await fs.access(DATA_FILE);
    console.log("Data file found.");
  } catch {
    console.log("Creating initial data file...");
    await fs.writeFile(DATA_FILE, JSON.stringify({
      vesselName: 'MT OCEAN STAR',
      imoNumber: '9876543',
      department: 'engine',
      machinery: [
        { id: 'me', name: 'Main Engine (ME)', desc: 'Primary propulsion system unit', icon: 'me', usedOils: ['me-sys', 'me-cyl'], lastModified: Date.now() },
        { id: 'ge', name: 'Generator Engine (GE)', desc: 'Auxiliary power generation units', icon: 'ge', usedOils: ['ge-sys'], lastModified: Date.now() },
        { id: 'blr', name: 'Boiler (BLR)', desc: 'Steam generation system', icon: 'blr', usedOils: [], lastModified: Date.now() }
      ],
      fuelTypes: [
        { id: 'fo', type: 'FO', consumption: '24.5', capacity: '1200', rob: '850.2', initialRob: '850.2', lastModified: Date.now() },
        { id: 'do', type: 'DO', consumption: '2.8', capacity: '350', rob: '180.5', initialRob: '180.5', lastModified: Date.now() }
      ],
      oilTypes: [
        { id: 'me-sys', name: 'ME SYS', consumption: '85', threshold: '200', capacity: '3000', rob: '1850', initialRob: '1850', lastModified: Date.now() },
        { id: 'me-cyl', name: 'ME CYL', consumption: '120', threshold: '300', capacity: '4500', rob: '2900', initialRob: '2900', lastModified: Date.now() },
        { id: 'ge-sys', name: 'GE SYS', consumption: '35', threshold: '100', capacity: '1500', rob: '950', initialRob: '950', lastModified: Date.now() }
      ],
      calculationMethod: 'flowmeter',
      fuelConsumptionData: {},
      oilConsumptionData: {},
      machineryHours: {},
      consumptionLogs: [],
      bunkerLogs: [],
      onboardingCompleted: true,
      voyageStatus: {
        date: new Date().toISOString().split('T')[0],
        time: "12:00",
        situation: 'Noon',
        voyageNumber: '042',
        portOfDeparture: 'SINGAPORE',
        destinationPort: 'ROTTERDAM',
        etaDate: '',
        etaTime: '12:00',
        distanceToGo: '850',
        totalDistance: '2400',
        expense: '',
        condition: 'Laden',
        remarks: ''
      },
      dashboardCards: [
        { id: 'vessel-info', type: 'vessel-info', title: 'Current Assignment', visible: true },
        { id: 'date', type: 'voyage-date', title: 'Report Date', visible: true },
        { id: 'time-status', type: 'voyage-time', title: 'Time & Status', visible: true },
        { id: 'voyage-info', type: 'voyage-info', title: 'Voyage Info', visible: true },
        { id: 'last-report', type: 'last-report', title: 'Last Submitted Report', visible: true },
        { id: 'activity', type: 'activity', title: "Today's Activity", visible: true }
      ],
      lastModified: Date.now()
    }, null, 2));
  }

  const getLocalIPs = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (ifaceList) {
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }
    }
    return ips;
  };

  const peers = new Set<string>();
  const myIps = getLocalIPs();

  // mDNS Peer Discovery
  try {
    const m = mdns();
    
    // Broadcast our presence every 30 seconds
    const broadcast = () => {
      m.respond({
        answers: [{
          name: 'bunker-watch.local',
          type: 'PTR',
          data: 'bunker-peer.local'
        }, {
          name: 'bunker-peer.local',
          type: 'SRV',
          data: { port: 3000, target: 'bunker-peer.local', priority: 10, weight: 10 }
        }, ...myIps.map(ip => ({
          name: 'bunker-peer.local',
          type: 'A',
          data: ip
        }))]
      });
    };

    m.on('query', (query) => {
      if (query.questions.some(q => q.name === 'bunker-watch.local')) {
        broadcast();
      }
    });

    m.on('response', (response) => {
      response.answers.forEach(ans => {
        if (ans.name === 'bunker-peer.local' && ans.type === 'A') {
          const peerIp = ans.data as string;
          if (!myIps.includes(peerIp)) {
            peers.add(peerIp);
            console.log(`🚢 New Peer Discovered: ${peerIp}`);
          }
        }
      });
    });

    // Initial broadcast and periodic refresh
    broadcast();
    setInterval(broadcast, 30000);
    
    // Periodically query for other peers
    const queryPeers = () => {
      m.query({
        questions: [{ name: 'bunker-watch.local', type: 'PTR' }]
      });
    };
    setInterval(queryPeers, 45000);
    queryPeers();

  } catch (e) {
    console.warn("mDNS failed (expected in cloud):", e);
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      ips: getLocalIPs(),
      peers: Array.from(peers)
    });
  });

  app.get("/api/peers", (req, res) => {
    res.json(Array.from(peers));
  });

  app.get("/api/data", async (req, res) => {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(404).json({ error: "No data found" });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
      res.json({ status: "success" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  // Static file serving logic
  const distPath = path.join(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    console.log("Running in PRODUCTION mode, serving static files from:", distPath);
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('manifest.json') || path.endsWith('manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log("Running in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error("Express Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    const ips = getLocalIPs();
    console.log(`\n🚢 SHIP SERVER ACTIVE (Zero-Internet Mode)`);
    console.log(`------------------------------------------`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`mDNS Access:  http://bunker.local`);
    console.log(`Direct IPs:   ${ips.map(ip => `http://${ip}:${PORT}`).join('\n              ')}`);
    console.log(`------------------------------------------\n`);
    console.log(`Type one of the Direct IPs into the "Ship Server IP" field in the app settings to sync.`);
  });
}

startServer();
