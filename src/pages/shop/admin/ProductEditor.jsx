import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi, uploadImage } from "../../../lib/shopApi.js";
import { BTN, INPUT, PANEL, FOCUS } from "../../../components/shop/ShopLayout.jsx";

const CONDITIONS = ["new", "open_box", "refurbished", "used_like_new", "used_good", "used_fair", "for_parts"];
const EMPTY = {
  title: "", description: "", price: "", condition: "new", stock: 1, category: "", status: "draft",
  weightOz: 16, lengthIn: 8, widthIn: 6, heightIn: 4,
};

function Field({ label, children, className = "", invalid }) {
  return (
    <label className={`block ${className}`}>
      <span className={`mb-1 block text-xs font-medium ${invalid ? "text-torays-red-dark" : "text-torays-text-secondary"}`}>{label}</span>
      {children}
    </label>
  );
}

export function ProductEditor() {
  const { id } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState(id ? null : EMPTY);
  const [photos, setPhotos] = useState([]); // [{ path, url }]
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    shopApi.adminProducts().then(({ products }) => {
      const p = products.find((x) => x.id === id);
      if (!p) return navigate("/tienda/admin", { replace: true });
      setForm({
        title: p.title, description: p.description, price: (p.priceCents / 100).toFixed(2), condition: p.condition,
        stock: p.stock, category: p.category, status: p.status,
        weightOz: p.weightOz, lengthIn: p.lengthIn, widthIn: p.widthIn, heightIn: p.heightIn,
      });
      setPhotos(p.imagePaths.map((path, i) => ({ path, url: p.images[i] })));
      return undefined;
    });
  }, [id, navigate]);

  async function addFiles(fileList) {
    const files = [...fileList].slice(0, 5 - photos.length);
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const up = await uploadImage(file);
        setPhotos((cur) => (cur.length < 5 ? [...cur, up] : cur));
      } catch {
        setError(t("shop.admin.editor.error"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const move = (i, d) =>
    setPhotos((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await shopApi.adminSaveProduct({ ...form, id: id || undefined, images: photos.map((p) => p.path) });
      navigate("/tienda/admin");
    } catch (err) {
      setError({ field: err.body?.field, text: t("shop.admin.editor.error") });
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <div className="h-80 animate-pulse rounded-2xl bg-torays-surface-alt" />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const bad = (k) => error?.field === k;
  const inputCls = (k) => `${INPUT} ${bad(k) ? "border-torays-red" : ""}`;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">{id ? t("shop.admin.editor.editTitle") : t("shop.admin.editor.newTitle")}</h1>
        <div className="flex gap-2">
          <button type="button" className={BTN.ghost} onClick={() => navigate("/tienda/admin")}>
            {t("shop.admin.editor.cancel")}
          </button>
          <button type="submit" className={BTN.dark} disabled={saving || uploading > 0}>
            {saving ? t("shop.admin.editor.saving") : t("shop.admin.editor.save")}
          </button>
        </div>
      </div>

      <section className={PANEL}>
        <h2 className="mb-3 font-heading text-lg font-semibold">
          {t("shop.admin.editor.photos")} <span className="text-sm font-normal text-torays-text-muted">({t("shop.admin.editor.photosCount", { n: photos.length })})</span>
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p, i) => (
            <div key={p.path} className="relative aspect-square overflow-hidden rounded-xl border border-torays-line bg-torays-surface-alt">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-torays-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">{t("shop.admin.editor.cover")}</span>}
              <button type="button" onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))} aria-label={t("shop.admin.editor.removePhoto")} className={`absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-torays-surface/95 text-torays-text shadow ${FOCUS}`}>
                <X size={15} />
              </button>
              <div className="absolute bottom-1 right-1 flex gap-1">
                {i > 0 && (
                  <button type="button" onClick={() => move(i, -1)} aria-label={t("shop.admin.editor.moveLeft")} className={`flex h-7 w-7 items-center justify-center rounded-full bg-torays-surface/95 shadow ${FOCUS}`}>
                    <ArrowLeft size={13} />
                  </button>
                )}
                {i < photos.length - 1 && (
                  <button type="button" onClick={() => move(i, 1)} aria-label={t("shop.admin.editor.moveRight")} className={`flex h-7 w-7 items-center justify-center rounded-full bg-torays-surface/95 shadow ${FOCUS}`}>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up${i}`} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-torays-line bg-torays-surface-alt text-xs text-torays-text-muted">
              <Loader2 size={18} className="animate-spin" /> {t("shop.admin.editor.uploading")}
            </div>
          ))}
          {photos.length + uploading < 5 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-torays-line text-xs font-medium text-torays-text-secondary hover:border-torays-navy/40 hover:text-torays-navy ${FOCUS}`}
            >
              <ImagePlus size={22} /> {t("shop.admin.editor.addPhoto")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-xs text-torays-text-muted">{t("shop.admin.editor.photosHint")}</p>
      </section>

      <section className={PANEL}>
        <h2 className="mb-3 font-heading text-lg font-semibold">{t("shop.admin.editor.info")}</h2>
        <div className="grid gap-3">
          <Field label={t("shop.admin.editor.titleLabel")} invalid={bad("title")}>
            <input className={inputCls("title")} value={form.title} onChange={set("title")} maxLength={140} required />
          </Field>
          <Field label={t("shop.admin.editor.descriptionLabel")} invalid={bad("description")}>
            <textarea className={`${inputCls("description")} min-h-[120px]`} value={form.description} onChange={set("description")} maxLength={5000} />
          </Field>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label={t("shop.admin.editor.price")} invalid={bad("price")}>
              <input className={inputCls("price")} value={form.price} onChange={set("price")} inputMode="decimal" placeholder="0.00" required />
            </Field>
            <Field label={t("shop.admin.editor.stock")} invalid={bad("stock")}>
              <input className={inputCls("stock")} type="number" min="0" value={form.stock} onChange={set("stock")} required />
            </Field>
            <Field label={t("shop.admin.editor.condition")} className="col-span-2 md:col-span-1">
              <select className={INPUT} value={form.condition} onChange={set("condition")}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`shop.conditions.${c}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("shop.admin.editor.category")} className="col-span-2 md:col-span-1" invalid={bad("category")}>
              <input className={inputCls("category")} value={form.category} onChange={set("category")} maxLength={40} />
            </Field>
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <h2 className="mb-3 font-heading text-lg font-semibold">{t("shop.admin.editor.package")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["weightOz", "weight"], ["lengthIn", "length"], ["widthIn", "width"], ["heightIn", "height"]].map(([k, label]) => (
            <Field key={k} label={t(`shop.admin.editor.${label}`)} invalid={bad(k)}>
              <input className={inputCls(k)} type="number" step="0.1" min="0.1" value={form[k]} onChange={set(k)} required />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-torays-text-muted">{t("shop.admin.editor.packageHint")}</p>
      </section>

      <section className={`${PANEL} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <div className="font-semibold">{t("shop.admin.editor.status")}</div>
          <div className="text-xs text-torays-text-muted">{t("shop.admin.editor.statusHint")}</div>
        </div>
        <div className="flex rounded-xl border border-torays-line bg-torays-surface p-1" role="radiogroup">
          {["draft", "published"].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={form.status === s}
              onClick={() => setForm((f) => ({ ...f, status: s }))}
              className={`min-h-10 rounded-lg px-4 text-sm font-medium ${FOCUS} ${form.status === s ? "bg-torays-navy text-white" : "text-torays-text-secondary"}`}
            >
              {t(`shop.admin.${s}`)}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm font-medium text-torays-red-dark">
          {typeof error === "string" ? error : error.text}
        </p>
      )}
    </form>
  );
}
