import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportTreeToPdf({ hideHeadshots = false } = {}) {
  const canvasElement = document.getElementById('canvas');
  if (!canvasElement) return;

  // 1. Apply export-specific classes to the body
  document.body.classList.add('exporting-active');
  if (hideHeadshots) {
    document.body.classList.add('export-hide-headshots');
  }

  try {
    // 2. Calculate the exact bounding box of the tree to avoid huge empty margins
    const cards = document.querySelectorAll('.card');
    if (cards.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    cards.forEach(card => {
      const style = window.getComputedStyle(card);
      const left = parseFloat(style.left);
      const top = parseFloat(style.top);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);

      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (left + width > maxX) maxX = left + width;
      if (top + height > maxY) maxY = top + height;
    });

    // Add padding around the final crop (in pixels)
    const padding = 60;
    const cropX = minX - padding;
    const cropY = minY - padding;
    const cropWidth = (maxX - minX) + (padding * 2);
    const cropHeight = (maxY - minY) + (padding * 2);

    // 3. Render the canvas with html2canvas using the calculated bounds
    const bgColor = window.getComputedStyle(document.body).getPropertyValue('background-color');
    
    const renderedCanvas = await html2canvas(canvasElement, {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
      backgroundColor: bgColor, 
      scale: 2, // Higher resolution for crisp text when printed
      useCORS: true, // Needed if headshots are hosted externally or via different paths
    });

    const imgData = renderedCanvas.toDataURL('image/png');

    // 4. Calculate best orientation for PDF & perfectly size the page to the tree
    const orientation = cropWidth > cropHeight ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [cropWidth, cropHeight] });

    pdf.addImage(imgData, 'PNG', 0, 0, cropWidth, cropHeight);
    pdf.save('family-tree.pdf');
  } finally {
    // 5. Always clean up classes, even if an error occurs
    document.body.classList.remove('exporting-active', 'export-hide-headshots');
  }
}