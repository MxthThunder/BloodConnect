import time

from django.core.management.base import BaseCommand

from escalation.service import service


class Command(BaseCommand):
    help = ('Runs one decision cycle for every open real emergency. Use --loop as a simple background worker '
            '(a production deployment would schedule this with cron / Celery beat).')

    def add_arguments(self, parser):
        parser.add_argument('--loop', action='store_true', help='Keep running until interrupted.')
        parser.add_argument('--interval', type=int, default=30, help='Seconds between cycles with --loop.')

    def handle(self, *args, **options):
        while True:
            results = service.evaluate_active_real_cases()
            changed = sum(1 for r in results if r.changed)
            self.stdout.write(f'Evaluated {len(results)} open emergency case(s); {changed} changed.')
            if not options['loop']:
                return
            try:
                time.sleep(options['interval'])
            except KeyboardInterrupt:
                return
