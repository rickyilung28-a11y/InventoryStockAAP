import React from 'react';
import { ThermalLabelTemplate } from '../utils/thermalTemplates';
import { StockItem, StorageLocation } from '../types/inventory';
import { ThermalBarcodeElement } from './ThermalBarcodeElement';
import { MapPin, Tag, Layers, Building2, Package, Boxes, CheckCircle2 } from 'lucide-react';

export interface StickerItemData {
  type: 'item';
  item: StockItem;
}

export interface StickerRackData {
  type: 'rack';
  location: StorageLocation;
}

export type StickerData = StickerItemData | StickerRackData;

interface ThermalStickerRendererProps {
  template: ThermalLabelTemplate;
  data: StickerData;
  companyName: string;
  logoUrl?: string;
  isPrint?: boolean;
  scale?: number; // Visual preview scaling factor (default 1)
}

export const ThermalStickerRenderer: React.FC<ThermalStickerRendererProps> = ({
  template,
  data,
  companyName,
  logoUrl,
  isPrint = false,
  scale = 1,
}) => {
  const { pageSize, design } = template;
  const isLandscape = pageSize.orientation === 'landscape';
  const widthMm = isLandscape ? pageSize.widthMm : pageSize.heightMm;
  const heightMm = isLandscape ? pageSize.heightMm : pageSize.widthMm;

  // Extract fields
  const isItem = data.type === 'item';
  const item = isItem ? data.item : null;
  const rack = !isItem ? data.location : null;

  const primaryCode = isItem ? item?.sku || '' : rack?.code || '';
  const secondaryName = isItem ? item?.name || '' : rack?.name || '';
  const categoryOrZone = isItem ? item?.category || '' : rack?.zone || '';
  const locationOrDesc = isItem ? item?.location || '' : rack?.description || '';

  // Border styles
  const borderClass = {
    none: 'border-0',
    thin: 'border border-black',
    bold: 'border-2 border-black',
    double: 'border-4 border-double border-black',
    rounded: 'border-2 border-black rounded-xl',
  }[design.borderStyle || 'thin'];

  // Font size helpers
  const headerFontClass = {
    xs: 'text-[9px] leading-tight',
    sm: 'text-[10.5px] leading-tight',
    base: 'text-xs leading-tight',
  }[design.headerFontSize || 'xs'];

  const titleFontClass = {
    sm: 'text-xs',
    base: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
    '2xl': 'text-xl',
  }[design.titleFontSize || 'lg'];

  const titleWeightClass = {
    normal: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
  }[design.titleFontWeight || 'black'];

  const nameFontClass = {
    xs: 'text-[9.5px]',
    sm: 'text-[11px]',
    base: 'text-xs',
  }[design.nameFontSize || 'xs'];

  const textAlignClass = design.contentAlign === 'center' ? 'text-center' : 'text-left';

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      className={`clabel-thermal-sticker bg-white text-black overflow-hidden flex flex-col justify-between box-border ${borderClass} select-none`}
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        padding: `${design.paddingMm || 1.5}mm`,
        transform: !isPrint && scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {/* 1. HEADER SECTION */}
      {design.showHeader && (
        <div className="shrink-0 mb-1">
          {design.headerType === 'inverted_bar' ? (
            <div className="bg-black text-white px-1.5 py-0.5 text-center font-black tracking-wider uppercase flex items-center justify-between text-[9px] rounded-xs">
              <span className="truncate flex-1">
                {design.customHeaderText || companyName || 'INVENTARIS GUDANG'}
              </span>
              {design.showDate && (
                <span className="text-[7.5px] font-mono text-zinc-300 ml-1 shrink-0">
                  {todayStr}
                </span>
              )}
            </div>
          ) : (
            <div
              className={`flex items-center justify-between border-b border-black pb-0.5 ${headerFontClass}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                {design.showLogo && (
                  logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-3.5 h-3.5 object-contain filter grayscale contrast-200"
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 bg-black text-white text-[7px] font-black rounded-xs flex items-center justify-center shrink-0">
                      AAP
                    </span>
                  )
                )}
                <span className="font-extrabold uppercase tracking-tight truncate">
                  {design.headerType === 'custom_text' && design.customHeaderText
                    ? design.customHeaderText
                    : companyName || 'PT. ABADI AGROSINDO PERSADA'}
                </span>
              </div>
              {design.showDate && (
                <span className="text-[7.5px] font-mono text-black font-bold shrink-0 ml-1">
                  {todayStr}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. BODY SECTION (Adaptive Barcode & Identifiers) */}
      <div className="flex-1 flex flex-col justify-center min-h-0 py-0.5">
        {design.barcodeType === 'qrcode' ? (
          // QR Code Split Layout: QR on side, Codes & Details on other side
          <div className="flex items-center gap-2">
            <div className="shrink-0">
              <ThermalBarcodeElement
                code={primaryCode}
                type="qrcode"
                height={design.barcodeHeight || 36}
                showText={false}
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* Primary Code */}
              <div
                className={`${titleFontClass} ${titleWeightClass} font-mono tracking-tight text-black truncate leading-tight`}
              >
                {primaryCode}
              </div>

              {/* Name */}
              {design.showName && secondaryName && (
                <div
                  className={`${nameFontClass} font-semibold text-black leading-tight ${
                    design.nameMaxLines === 1 ? 'truncate' : 'line-clamp-2'
                  }`}
                >
                  {secondaryName}
                </div>
              )}

              {/* Extra badges */}
              <div className="flex flex-wrap items-center gap-1 mt-1 text-[8px] font-mono">
                {isItem && design.showLocation && locationOrDesc && (
                  <span className="border border-black px-1 py-0.2 rounded-xs font-bold whitespace-nowrap">
                    Rak: {locationOrDesc}
                  </span>
                )}
                {isItem && design.showCategory && categoryOrZone && (
                  <span className="bg-black text-white px-1 py-0.2 rounded-xs font-semibold whitespace-nowrap">
                    {categoryOrZone}
                  </span>
                )}
                {!isItem && design.showZone && categoryOrZone && (
                  <span className="bg-black text-white px-1 py-0.2 rounded-xs font-bold whitespace-nowrap">
                    {categoryOrZone}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Standard 1D Barcode Layout: Stacked
          <div className={`flex flex-col items-center justify-center w-full ${textAlignClass}`}>
            {/* Primary SKU / Rack Code */}
            <div
              className={`w-full ${titleFontClass} ${titleWeightClass} font-mono tracking-wider text-black truncate leading-tight`}
            >
              {primaryCode}
            </div>

            {/* Subtitle Name */}
            {design.showName && secondaryName && (
              <div
                className={`w-full ${nameFontClass} font-semibold text-black leading-tight mb-1 ${
                  design.nameMaxLines === 1 ? 'truncate' : 'line-clamp-2'
                }`}
              >
                {secondaryName}
              </div>
            )}

            {/* 1D Barcode Graphic */}
            <div className="w-full my-0.5">
              <ThermalBarcodeElement
                code={primaryCode}
                type="code128"
                height={design.barcodeHeight || 30}
                showText={design.showBarcodeText}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. METADATA & FOOTER SECTION */}
      <div className="shrink-0 mt-0.5 pt-0.5 border-t border-black/30 text-[8px] font-mono">
        <div className="flex items-center justify-between gap-1">
          {/* Left badge */}
          <div className="flex items-center gap-1 truncate">
            {isItem && design.showLocation && locationOrDesc && design.barcodeType !== 'qrcode' && (
              <span className="font-bold border border-black px-1 rounded-2xs">
                Rak: {locationOrDesc}
              </span>
            )}
            {isItem && design.showCategory && categoryOrZone && design.barcodeType !== 'qrcode' && (
              <span className="font-semibold bg-black text-white px-1 rounded-2xs">
                {categoryOrZone}
              </span>
            )}
            {isItem && design.showStock && item && (
              <span className="font-bold">
                Stok: {item.currentStock} {item.unit}
              </span>
            )}
            {!isItem && design.showZone && categoryOrZone && design.barcodeType !== 'qrcode' && (
              <span className="font-bold bg-black text-white px-1 rounded-2xs">
                {categoryOrZone}
              </span>
            )}
            {!isItem && design.showDescription && locationOrDesc && (
              <span className="truncate">{locationOrDesc}</span>
            )}
          </div>

          {/* Right text / Custom Footer */}
          <div className="shrink-0 text-right font-extrabold uppercase text-[7.5px]">
            {design.customFooterText ? (
              <span>{design.customFooterText}</span>
            ) : design.showDate && !design.showHeader ? (
              <span>{todayStr}</span>
            ) : (
              <span>ORIGINAL PART</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
