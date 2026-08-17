import { Activity, Award, CircuitBoard, Crosshair, DollarSign, Microscope, MessageCircle, ShieldCheck, Users, Zap } from "lucide-react";

/**
 * Explicit allow-list for icons selected by name from config data
 * (features.config.js / about.config.js). A namespace import
 * (`import * as Icons from "lucide-react"`) defeats tree-shaking and
 * pulls the entire icon library into the bundle — add a new icon here
 * (import + entry) when a config entry needs one, never re-add `import *`.
 */
export const ICONS = {
  Activity,
  Award,
  CircuitBoard,
  Crosshair,
  DollarSign,
  Microscope,
  MessageCircle,
  ShieldCheck,
  Users,
  Zap,
};
