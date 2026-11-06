"""What a patient attaches to an appointment booking.

Single source of truth for BOTH the preview the patient confirms and the
snapshot that is stored for the doctor, so "what you see is what is shared".
Only data that exists AND that the patient ticked is included; contact details
are not shared (the doctor reaches the patient through the appointment).
"""
CONSENT_VERSION = '2026-02'
CONSENT_TEXT = (
    'I consent to DermaScan AI attaching the report items listed above to this appointment request so that '
    'the selected doctor can view them. I understand I can withdraw access at any time.'
)


def build_share(scan, user, options):
    options = options or {}
    d = scan.to_dict()
    has_image = bool(scan.image_path)
    has_recs = bool(d['recommendations'])
    inc_image = bool(options.get('include_image')) and has_image
    inc_recs = bool(options.get('include_recommendations')) and has_recs

    snapshot = {
        'report_reference': scan.scan_id,
        'assessment_date': d['created_at'],
        'patient': {'name': user.name},
        'results': {
            'condition': d['disease_name'], 'confidence_score': d['confidence_score'],
            'severity': d['severity'], 'symptoms': d['symptoms'],
            'model_version': d['model_version'], 'is_demo': d['is_demo'],
        },
    }
    if inc_recs:
        snapshot['ai_recommendations'] = d['recommendations']
    if inc_image:
        snapshot['image'] = {'shared': True}

    sections = [
        {'key': 'identity', 'label': 'Your name', 'detail': user.name, 'available': True, 'required': True, 'included': True},
        {'key': 'results', 'label': 'Assessment results',
         'detail': '%s, confidence %s%%, severity %s' % (d['disease_name'], d['confidence_score'], d['severity']),
         'available': True, 'required': True, 'included': True},
        {'key': 'reference', 'label': 'Report reference and assessment date',
         'detail': '%s, %s' % (scan.scan_id, (d['created_at'] or '')[:10]), 'available': True, 'required': True, 'included': True},
        {'key': 'include_recommendations', 'label': 'AI findings and recommended treatment',
         'detail': '%d item(s)' % len(d['recommendations']) if has_recs else 'Not available for this report',
         'available': has_recs, 'required': False, 'included': inc_recs},
        {'key': 'include_image', 'label': 'Uploaded skin image',
         'detail': 'Only this doctor can view it, through the secure portal' if has_image else 'Not available for this report',
         'available': has_image, 'required': False, 'included': inc_image},
    ]
    return snapshot, sections, {'include_image': inc_image, 'is_demo': d['is_demo']}
