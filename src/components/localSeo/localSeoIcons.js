import {
  Battery,
  BatteryCharging,
  Cable,
  CircuitBoard,
  Cpu,
  Droplet,
  Droplets,
  Fan,
  Gamepad2,
  HardDrive,
  Joystick,
  MonitorX,
  Plug,
  PowerOff,
  RotateCcw,
  ScanSearch,
  Smartphone,
  Thermometer,
  ToggleLeft,
  Tv,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Icon allow-list for the local SEO pages' service/issue grids
 * (localSeo.config.js), kept separate from src/lib/iconRegistry.js on
 * purpose — that registry is imported eagerly by Home's Hero/WhyChooseUs,
 * so adding these icons there would pull them into the main/initial
 * bundle even though only these lazy pages use them. This file is only
 * imported by IconInfoGrid.jsx, so it rides along in the local SEO pages'
 * own lazy chunk instead.
 */
export const LOCAL_SEO_ICONS = {
  Battery,
  BatteryCharging,
  Cable,
  CircuitBoard,
  Cpu,
  Droplet,
  Droplets,
  Fan,
  Gamepad2,
  HardDrive,
  Joystick,
  MonitorX,
  Plug,
  PowerOff,
  RotateCcw,
  ScanSearch,
  Smartphone,
  Thermometer,
  ToggleLeft,
  Tv,
  Wrench,
  Zap,
};
