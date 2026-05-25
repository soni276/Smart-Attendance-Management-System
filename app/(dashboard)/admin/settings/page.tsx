"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Eye,
  EyeOff,
  MapPin,
  Moon,
  Save,
  Shield,
  Sparkles,
  Sun,
} from "lucide-react";
import { buildClientStoreSnapshot } from "@/lib/client-store";
import { resetDemoData } from "@/lib/seed";
import {
  clearAllData,
  exportAllData,
  getSettings,
  importAllData,
  saveSettings,
} from "@/lib/storage";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast-helpers";
import type { AppSettings } from "@/types";

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-7 w-12 rounded-full transition-colors ${
        enabled ? "bg-indigo-600" : "bg-white/10"
      }`}
    >
      <motion.span
        layout
        className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [logoPreview, setLogoPreview] = useState(settings.schoolLogo ?? "");

  useEffect(() => {
    setSettings(getSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    setLogoPreview(settings.schoolLogo ?? "");
  }, [settings.schoolLogo]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      saveSettings(settings);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = settings.theme;
      }
    }, 400);
    return () => clearTimeout(t);
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    toastSuccess("Settings saved");
  };

  const handleTestApi = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.openaiApiKey,
          model: settings.openaiModel ?? "gpt-4o-mini",
          _store: buildClientStoreSnapshot(),
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      if (data.success) toastSuccess(data.message ?? "Connection OK");
      else toastError(data.error ?? "Test failed");
    } catch {
      toastError("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sas-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastInfo("Data exported");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Record<string, unknown>;
        importAllData(data);
        setSettings(getSettings());
        toastSuccess("Data imported");
        window.location.reload();
      } catch {
        toastError("Invalid JSON file");
      }
    };
    input.click();
  };

  const faceLabel =
    settings.faceMatchThreshold <= 0.4
      ? "Strict"
      : settings.faceMatchThreshold >= 0.6
        ? "Lenient"
        : "Moderate";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">Settings</h2>
        <p className="mt-1 text-slate-400">Configure your Smart Attendance System.</p>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Shield className="h-5 w-5 text-indigo-400" />
          General
        </h3>
        <label className="block text-sm text-slate-400">School name</label>
        <input
          value={settings.schoolName}
          onChange={(e) => update({ schoolName: e.target.value })}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
        />
        <label className="mt-4 block text-sm text-slate-400">School logo</label>
        <div className="mt-2 flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 bg-cover bg-center"
            style={
              logoPreview
                ? { backgroundImage: `url(${logoPreview})` }
                : undefined
            }
          >
            {!logoPreview && (
              <span className="text-xs text-slate-500">Logo</span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = reader.result as string;
                setLogoPreview(url);
                update({ schoolLogo: url });
              };
              reader.readAsDataURL(file);
            }}
            className="text-sm text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          {settings.theme === "light" ? (
            <Sun className="h-5 w-5 text-amber-300" />
          ) : (
            <Moon className="h-5 w-5 text-indigo-300" />
          )}
          Appearance
        </h3>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div>
            <p className="text-sm font-medium text-white">Theme</p>
            <p className="text-xs text-slate-500">
              Switch between dark and light interface.
            </p>
          </div>
          <div className="flex gap-2 rounded-lg bg-white/5 p-1">
            <button
              type="button"
              onClick={() => update({ theme: "dark" })}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                settings.theme === "dark"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => update({ theme: "light" })}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                settings.theme === "light"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Attendance Rules
        </h3>
        <label className="text-sm text-slate-400">
          Minimum attendance: {settings.minAttendancePercent}%
        </label>
        <input
          type="range"
          min={50}
          max={100}
          value={settings.minAttendancePercent}
          onChange={(e) =>
            update({ minAttendancePercent: Number(e.target.value) })
          }
          className="mt-2 w-full accent-indigo-500"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-slate-400">Late after (minutes)</label>
            <input
              type="number"
              min={1}
              value={settings.latenessMinutes}
              onChange={(e) =>
                update({ latenessMinutes: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Absent after (minutes)</label>
            <input
              type="number"
              min={1}
              value={settings.absentMinutes}
              onChange={(e) =>
                update({ absentMinutes: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
        </div>
        <div className="mt-4 flex h-10 overflow-hidden rounded-lg text-xs font-medium">
          <div
            className="flex items-center justify-center bg-green-500/30 text-green-300"
            style={{
              width: `${(settings.latenessMinutes / settings.absentMinutes) * 100}%`,
            }}
          >
            Present
          </div>
          <div className="flex flex-1 items-center justify-center bg-amber-500/30 text-amber-300">
            Late
          </div>
          <div className="flex w-1/4 items-center justify-center bg-red-500/30 text-red-300">
            Absent
          </div>
        </div>
        <button type="button" onClick={handleSave} className="mt-4 text-sm text-indigo-400 hover:underline">
          Save rules
        </button>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">QR Settings</h3>
        <label className="text-sm text-slate-400">
          QR expiry: {settings.qrExpirySeconds}s
        </label>
        <input
          type="range"
          min={30}
          max={300}
          step={10}
          value={settings.qrExpirySeconds}
          onChange={(e) =>
            update({ qrExpirySeconds: Number(e.target.value) })
          }
          className="mt-2 w-full accent-indigo-500"
        />
        <p className="mt-2 text-sm text-slate-500">
          QR will rotate every {settings.qrExpirySeconds} seconds
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-white">
          Face Recognition
        </h3>
        <label className="text-sm text-slate-400">
          Threshold: {settings.faceMatchThreshold} ({faceLabel})
        </label>
        <input
          type="range"
          min={0.4}
          max={0.6}
          step={0.05}
          value={settings.faceMatchThreshold}
          onChange={(e) =>
            update({ faceMatchThreshold: Number(e.target.value) })
          }
          className="mt-2 w-full accent-indigo-500"
        />
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 transition-all"
            style={{ width: `${((settings.faceMatchThreshold - 0.4) / 0.2) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Strict 0.4 · Moderate 0.5 · Lenient 0.6
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <MapPin className="h-5 w-5 text-indigo-400" />
            Geo-Fencing
          </h3>
          <Toggle
            enabled={settings.geoFencingEnabled}
            onChange={(v) => update({ geoFencingEnabled: v })}
          />
        </div>
        {settings.geoFencingEnabled && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.geoLat}
                  onChange={(e) => update({ geoLat: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.geoLng}
                  onChange={(e) => update({ geoLng: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
                />
              </div>
            </div>
            <label className="mt-4 block text-sm text-slate-400">
              Radius: {settings.geoRadiusMeters}m
            </label>
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={settings.geoRadiusMeters}
              onChange={(e) =>
                update({ geoRadiusMeters: Number(e.target.value) })
              }
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="mt-4 grid h-32 grid-cols-8 grid-rows-6 gap-0.5 rounded-lg border border-white/10 bg-slate-900/50 p-2">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    i >= 18 && i <= 29 ? "bg-indigo-500/40" : "bg-white/5"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">
              Map preview · center = school location
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Sparkles className="h-5 w-5 text-purple-400" />
          AI & API
        </h3>
        <label className="text-sm text-slate-400">OpenAI API key</label>
        <div className="relative mt-1">
          <input
            type={showKey ? "text" : "password"}
            value={settings.openaiApiKey ?? ""}
            onChange={(e) => update({ openaiApiKey: e.target.value })}
            placeholder="sk-…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-10 pl-3 text-white"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <label className="mt-4 block text-sm text-slate-400">Model</label>
        <select
          value={settings.openaiModel ?? "gpt-4o"}
          onChange={(e) =>
            update({
              openaiModel: e.target.value as AppSettings["openaiModel"],
            })
          }
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
        >
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
        </select>
        <button
          type="button"
          onClick={handleTestApi}
          disabled={testing}
          className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test Connection"}
        </button>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Database className="h-5 w-5 text-slate-400" />
          Data Management
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            Export All Data
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            Import Data
          </button>
          <button
            type="button"
            onClick={() => {
              resetDemoData();
              setSettings(getSettings());
              toastSuccess("Demo data reset");
              window.location.reload();
            }}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
          >
            Reset Demo Data
          </button>
        </div>
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-300">Clear All Data</p>
          <p className="mt-1 text-xs text-slate-500">
            Type DELETE to confirm permanent data removal.
          </p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="mt-2 w-full rounded-lg border border-red-500/20 bg-black/20 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={deleteConfirm !== "DELETE"}
            onClick={() => {
              clearAllData();
              toastInfo("All data cleared");
              window.location.href = "/login";
            }}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Clear All Data
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 font-medium text-white"
      >
        <Save className="h-5 w-5" />
        Save All Settings
      </button>
    </div>
  );
}
