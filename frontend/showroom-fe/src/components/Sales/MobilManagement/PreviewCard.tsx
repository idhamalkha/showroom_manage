type PreviewProps = {
  title?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  colors?: {
    nama_warna: string;
    kode_hex: string;
    is_active: boolean;
  }[];
};

export default function PreviewCard({ 
  title, 
  subtitle, 
  imageUrl, 
  tags = [],
  colors = []
}: PreviewProps) {
  return (
    <div className="avm-preview-card">
      <div className="avm-preview-img-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt={title ?? "preview"} className="avm-preview-img" />
        ) : (
          <div className="avm-preview-empty">No image</div>
        )}
      </div>

      <div className="avm-preview-meta">
        <div className="avm-preview-title">{title}</div>
        {subtitle ? <div className="avm-preview-sub">{subtitle}</div> : null}
        
        {/* Show fuel tag first */}
        <div className="avm-preview-tags">
          {tags.map((t, i) => {
            const val = t ?? '';
            const v = String(val).toLowerCase();
            const isFuel = v === 'gasoline' || v === 'diesel' || v === 'electrified';
            const label = val ? (String(val).charAt(0).toUpperCase() + String(val).slice(1)) : val;
            return (
              <span key={i} className={`avm-tag${isFuel ? ' avm-tag-fuel' : ''}`}>{label}</span>
            );
          })}
        </div>

        {/* Show color swatches */}
        {colors.length > 0 && (
          <div className="avm-preview-colors">
            {colors.filter(c => c.is_active).map((color, i) => (
              <div 
                key={i}
                className="avm-color-swatch"
                style={{
                  backgroundColor: color.kode_hex,
                  opacity: color.is_active ? 1 : 0.5
                }}
                title={color.nama_warna}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
