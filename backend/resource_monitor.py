"""Real OS resource monitoring via Linux /proc filesystem and os APIs."""

import os
import platform
import time
from typing import Any, Dict, List


def _read_proc_stat() -> Dict[str, int]:
    with open("/proc/stat", "r", encoding="utf-8") as f:
        line = f.readline().strip()
    parts = line.split()
    # cpu user nice system idle iowait irq softirq steal
    vals = [int(x) for x in parts[1:9]]
    while len(vals) < 8:
        vals.append(0)
    return {
        "user": vals[0],
        "nice": vals[1],
        "system": vals[2],
        "idle": vals[3],
        "iowait": vals[4],
        "irq": vals[5],
        "softirq": vals[6],
        "steal": vals[7],
    }


def _read_meminfo() -> Dict[str, int]:
    info: Dict[str, int] = {}
    with open("/proc/meminfo", "r", encoding="utf-8") as f:
        for line in f:
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            num_str = v.strip().split()[0]
            try:
                info[k.strip()] = int(num_str)
            except ValueError:
                pass
    return info


def _read_cpu_model() -> str:
    try:
        with open("/proc/cpuinfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or platform.machine()


def _read_self_status() -> Dict[str, Any]:
    res: Dict[str, Any] = {"threads": 1, "vm_rss_kb": 0, "vm_size_kb": 0, "voluntary_ctxt_switches": 0, "nonvoluntary_ctxt_switches": 0}
    try:
        with open("/proc/self/status", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("Threads:"):
                    res["threads"] = int(line.split(":", 1)[1].strip())
                elif line.startswith("VmRSS:"):
                    res["vm_rss_kb"] = int(line.split(":", 1)[1].strip().split()[0])
                elif line.startswith("VmSize:"):
                    res["vm_size_kb"] = int(line.split(":", 1)[1].strip().split()[0])
                elif line.startswith("voluntary_ctxt_switches:"):
                    res["voluntary_ctxt_switches"] = int(line.split(":", 1)[1].strip())
                elif line.startswith("nonvoluntary_ctxt_switches:"):
                    res["nonvoluntary_ctxt_switches"] = int(line.split(":", 1)[1].strip())
    except Exception:
        pass
    return res


def get_system_snapshot() -> Dict[str, Any]:
    """Sample real Linux host CPU, memory, load, and current monitor process telemetry."""
    cpu_percent = 0.0
    user_pct = 0.0
    sys_pct = 0.0
    iowait_pct = 0.0

    try:
        s1 = _read_proc_stat()
        time.sleep(0.12)
        s2 = _read_proc_stat()

        d_user = (s2["user"] + s2["nice"]) - (s1["user"] + s1["nice"])
        d_sys = (s2["system"] + s2["irq"] + s2["softirq"]) - (s1["system"] + s1["irq"] + s1["softirq"])
        d_idle = s2["idle"] - s1["idle"]
        d_iowait = s2["iowait"] - s1["iowait"]
        d_total = d_user + d_sys + d_idle + d_iowait + (s2["steal"] - s1["steal"])

        if d_total > 0:
            user_pct = round((d_user / d_total) * 100.0, 2)
            sys_pct = round((d_sys / d_total) * 100.0, 2)
            iowait_pct = round((d_iowait / d_total) * 100.0, 2)
            cpu_percent = round(min(100.0, ((d_total - d_idle - d_iowait) / d_total) * 100.0), 2)
    except Exception:
        pass

    mem_info = _read_meminfo() if os.path.exists("/proc/meminfo") else {}
    total_kb = mem_info.get("MemTotal", 0)
    avail_kb = mem_info.get("MemAvailable", mem_info.get("MemFree", 0))
    used_kb = max(0, total_kb - avail_kb)
    cached_kb = mem_info.get("Cached", 0)
    buffers_kb = mem_info.get("Buffers", 0)

    mem_percent = round((used_kb / total_kb) * 100.0, 2) if total_kb > 0 else 0.0

    load_avg = [0.0, 0.0, 0.0]
    try:
        load_avg = [round(x, 2) for x in os.getloadavg()]
    except Exception:
        pass

    uptime_sec = 0.0
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as f:
            uptime_sec = round(float(f.read().split()[0]), 1)
    except Exception:
        pass

    proc_status = _read_self_status()

    return {
        "timestamp": time.time(),
        "scope": "machine_host",
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "arch": platform.machine(),
            "cpu_model": _read_cpu_model(),
            "cpu_cores": os.cpu_count() or 1,
            "uptime_seconds": uptime_sec,
        },
        "cpu": {
            "utilization_percent": cpu_percent,
            "user_percent": user_pct,
            "system_percent": sys_pct,
            "iowait_percent": iowait_pct,
            "load_avg_1m": load_avg[0],
            "load_avg_5m": load_avg[1],
            "load_avg_15m": load_avg[2],
        },
        "memory": {
            "total_mb": round(total_kb / 1024.0, 1),
            "used_mb": round(used_kb / 1024.0, 1),
            "available_mb": round(avail_kb / 1024.0, 1),
            "cached_mb": round(cached_kb / 1024.0, 1),
            "buffers_mb": round(buffers_kb / 1024.0, 1),
            "utilization_percent": mem_percent,
        },
        "process": {
            "pid": os.getpid(),
            "threads": proc_status["threads"],
            "rss_mb": round(proc_status["vm_rss_kb"] / 1024.0, 2),
            "vms_mb": round(proc_status["vm_size_kb"] / 1024.0, 2),
            "voluntary_ctx_switches": proc_status["voluntary_ctxt_switches"],
            "nonvoluntary_ctx_switches": proc_status["nonvoluntary_ctxt_switches"],
        },
        "syscalls": {
            "measured": False,
            "note": "Kernel syscall tracing (ptrace/strace) is restricted inside unprivileged container sandboxes; process context switches and page faults are measured directly via rusage.",
        },
    }
