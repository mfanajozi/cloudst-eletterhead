import 'dart:typed_data';

import 'package:hive_flutter/hive_flutter.dart';

/// A single letter stored strictly on-device (no cloud replication — see PRD
/// System Boundary Limits #1). Hive-backed via plain maps: no codegen needed.
class LetterDraft {
  LetterDraft({
    required this.id,
    required this.createdAt,
    this.to = '',
    this.date = '',
    this.salutation = '',
    this.body = '',
    this.signatureBytes,
    this.pdfPath,
    this.paperFormat = 'A4',
  });

  final String id; // timestamp-based unique id
  final int createdAt;
  String to;
  String date;
  String salutation;
  String body;
  Uint8List? signatureBytes; // transparent PNG drawn on the signature pad
  String? pdfPath; // application-documents path of the generated read-only PDF
  String paperFormat; // 'A4' | 'Letter'

  Map<String, dynamic> toHive() => <String, dynamic>{
        'id': id,
        'createdAt': createdAt,
        'to': to,
        'date': date,
        'salutation': salutation,
        'body': body,
        'signature': signatureBytes,
        'pdfPath': pdfPath,
        'paperFormat': paperFormat,
      };

  factory LetterDraft.fromHive(Map<dynamic, dynamic> m) => LetterDraft(
        id: m['id'] as String? ?? 'unknown',
        createdAt: m['createdAt'] as int? ?? 0,
        to: m['to'] as String? ?? '',
        date: m['date'] as String? ?? '',
        salutation: m['salutation'] as String? ?? '',
        body: m['body'] as String? ?? '',
        signatureBytes: m['signature'] is Uint8List
            ? m['signature'] as Uint8List
            : null,
        pdfPath: m['pdfPath'] as String?,
        paperFormat: m['paperFormat'] as String? ?? 'A4',
      );

  bool get hasSignature => signatureBytes != null && signatureBytes!.isNotEmpty;
}

/// Repository over the Hive 'letters' box.
class LetterStore {
  LetterStore._(this._box);

  static LetterStore? _instance;
  late final Box<dynamic> _box;

  static Future<LetterStore> instance() async {
    if (_instance == null) {
      await Hive.initFlutter();
      _instance = LetterStore._(await Hive.openBox('letters'));
    }
    return _instance!;
  }

  /// All letters, newest first.
  List<LetterDraft> list() {
    final items = _box.values.whereType<Map<dynamic, dynamic>>().toList();
    return items.map(LetterDraft.fromHive).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  LetterDraft? byId(String id) {
    final raw = _box.get(id);
    return raw is Map ? LetterDraft.fromHive(raw) : null;
  }

  Future<void> save(LetterDraft draft) => _box.put(draft.id, draft.toHive());

  Future<void> delete(String id) => _box.delete(id);

  /// Destructive: clears every letter. The app surface must always pair this
  /// with the storage-reset warning (PRD Boundary #2).
  Future<void> wipeAll() => _box.clear();
}
