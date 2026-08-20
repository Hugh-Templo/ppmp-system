<x-mail::message>
# {{ $title }}

@if ($recipientName)
Hello {{ $recipientName }},
@else
Hello,
@endif

{{ $message }}

**Fiscal Year:** {{ $fiscalYear }}  
**PPMP Submission Deadline:** {{ $deadline }}

Please log in to the APP Consolidation System to upload and submit your office PPMP before the deadline.

@if ($appUrl)
<x-mail::button :url="$appUrl">
Open Dashboard
</x-mail::button>
@endif

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
