import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:hive_flutter/hive_flutter.dart';

/// Tracks acknowledgment of the destructive-storage-reset warning (PRD
/// Boundary #2). Works on web (IndexedDB) and native platforms alike.
class StorageNotice {
  static bool? _hasAcknowledged;

  static bool get hasAcknowledged => _hasAcknowledged ?? false;

  static Future<void> ensureAcknowledged(String boxKey) async {
    final box = await Hive.openBox('settings');
    _hasAcknowledged = box.get(boxKey) as bool? ?? false;
    if (!_hasAcknowledged!) {
      // The caller shows the dialog; we persist only after the user's
      // confirmation via [acknowledge].
      _hasAcknowledged = true;
    }
  }

  static Future<void> acknowledge(String boxKey) async {
    final box = await Hive.openBox('settings');
    await box.put(boxKey, true);
    _hasAcknowledged = true;
  }
}

/// Guard so tests and web targets skip file-only side effects.
final bool supportsLocalFiles = !kIsWeb;
