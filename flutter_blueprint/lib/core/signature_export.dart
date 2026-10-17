import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:signature/signature.dart';

/// Platform-independent PNG export of the signature pad contents.
///
/// The `signature` package renders its NATIVE export through
/// `ui.Image.toByteData(png)`, an Impeller/Skia-dependent path that has been
/// seen to silently drop the output on some Android devices, while its WEB
/// path re-renders the recorded strokes with the pure-Dart `image` package.
/// This helper always takes that proven pure-Dart path on every platform so
/// the vector signature survives into the PDF identically everywhere.
///
/// Rendering mirrors `signature` 5.5.0's own web implementation:
/// - tight bounding-box canvas (points' extent + 2× penStrokeWidth),
/// - transparent background when none configured,
/// - connected strokes as lines, taps as circles.
Uint8List? exportSignaturePng(SignatureController controller) {
  if (controller.isEmpty) return null;

  final pen = img.ColorRgb8(
    controller.exportPenColor?.red ?? controller.penColor.red,
    controller.exportPenColor?.green ?? controller.penColor.green,
    controller.exportPenColor?.blue ?? controller.penColor.blue,
  );

  final bg = controller.exportBackgroundColor;
  final background = img.ColorRgba8(
    bg?.red ?? 0,
    bg?.green ?? 0,
    bg?.blue ?? 0,
    (bg?.alpha ?? 0.0).toInt(),
  );

  final minX = controller.minXValue!;
  final minY = controller.minYValue!;
  final dx = minX - controller.penStrokeWidth;
  final dy = minY - controller.penStrokeWidth;

  final image = img.Image(
    width: controller.defaultWidth!,
    height: controller.defaultHeight!,
    numChannels: 4,
  );
  img.fill(image, color: background);

  final points = controller.points;
  for (int i = 0; i < points.length - 1; i++) {
    final x1 = (points[i].offset.dx - dx).toInt();
    final y1 = (points[i].offset.dy - dy).toInt();
    if (points[i + 1].type == PointType.move) {
      img.drawLine(
        image,
        x1: x1,
        y1: y1,
        x2: (points[i + 1].offset.dx - dx).toInt(),
        y2: (points[i + 1].offset.dy - dy).toInt(),
        color: pen,
        thickness: controller.penStrokeWidth,
      );
    } else {
      img.fillCircle(
        image,
        x: x1,
        y: y1,
        radius: controller.penStrokeWidth.toInt(),
        color: pen,
      );
    }
  }

  return Uint8List.fromList(img.encodePng(image));
}
