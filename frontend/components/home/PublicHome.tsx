import React, { useMemo } from "react";
import { type Material } from "../../api/client";

import PriceTicker from "./public/PriceTicker";
import PublicHeader from "./public/PublicHeader";
import PublicHero from "./public/PublicHero";
import PriceCatalog from "./public/PriceCatalog";
import CalculatorSection from "./public/CalculatorSection";
import ProcessSection from "./public/ProcessSection";
import WhyUsSection from "./public/WhyUsSection";
import PublicFooter from "./public/PublicFooter";

// Phế Liệu Thiên Nhung public home entry
// Features: Giá thu mua hôm nay, ƯỚC TÍNH NHANH, Quy trình thu mua & Cam kết

type PublicHomeProps = {
  materials: Material[];
  selectedMatName: string;
  setSelectedMatName: (value: string) => void;
  kg: number;
  setKg: (value: number) => void;
  onOpenLogin: () => void;
};

export default function PublicHome({
  materials,
  selectedMatName,
  setSelectedMatName,
  kg,
  setKg,
  onOpenLogin,
}: PublicHomeProps) {
  const selectedMaterial = useMemo(
    () => materials.find((item) => item.name === selectedMatName) || materials[0],
    [materials, selectedMatName],
  );

  const handleSelectForCalc = (matName: string) => {
    setSelectedMatName(matName);
    const calcElement = document.getElementById("gia-ung-tinh");
    if (calcElement) {
      calcElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="public-home">
      {/* Live Market Price Ticker */}
      <PriceTicker />

      {/* Glassmorphism Header */}
      <PublicHeader onOpenLogin={onOpenLogin} />

      {/* Hero Section with Interactive 3D Canvas */}
      <PublicHero
        selectedMaterial={selectedMaterial}
        materials={materials}
        onSelectMaterial={setSelectedMatName}
      />

      {/* Live Material Price Catalog: Giá thu mua hôm nay */}
      <PriceCatalog
        materials={materials}
        onSelectForCalc={handleSelectForCalc}
      />

      {/* Interactive Price Estimator Calculator: ƯỚC TÍNH NHANH */}
      <CalculatorSection
        materials={materials}
        selectedMatName={selectedMatName}
        setSelectedMatName={setSelectedMatName}
        kg={kg}
        setKg={setKg}
      />

      {/* 4-Step Professional Process Workflow */}
      <ProcessSection />

      {/* Guarantees & Differentiator Cards */}
      <WhyUsSection materials={materials} />

      {/* Footer & Floating Action Widgets */}
      <PublicFooter />
    </main>
  );
}
