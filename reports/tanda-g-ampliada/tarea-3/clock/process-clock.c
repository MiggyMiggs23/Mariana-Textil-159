#define _GNU_SOURCE
#include <time.h>
#include <sys/time.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>

/* PRIVATE TEST ONLY: shift wall clocks; never intercept monotonic clocks.
 * The sole shared state is an atomically replaced, mode-0600 offset file.
 * No system clock calls, database updates, or business-rule changes. */
#define FILEPATH "/home/runner/workspace/.local/tanda-g-ampliada/month-clock-offset"
static int64_t offset(void) {
  char buf[64], *end;
  int fd = open(FILEPATH, O_RDONLY | O_CLOEXEC);
  if (fd < 0) _exit(120);
  ssize_t n = read(fd, buf, sizeof(buf)-1);
  close(fd);
  if (n <= 0) _exit(121);
  buf[n] = 0;
  errno = 0;
  int64_t v = strtoll(buf, &end, 10);
  if (errno || end == buf || (*end != '\n' && *end != 0)) _exit(122);
  return v;
}
int clock_gettime(clockid_t id, struct timespec *ts) {
  int rc = syscall(SYS_clock_gettime, id, ts);
  if (!rc && (id == CLOCK_REALTIME || id == CLOCK_REALTIME_COARSE)) {
    int64_t ns = (int64_t)ts->tv_sec * 1000000000LL + ts->tv_nsec + offset();
    ts->tv_sec = ns / 1000000000LL;
    ts->tv_nsec = ns % 1000000000LL;
  }
  return rc;
}
int gettimeofday(struct timeval *tv, void *tz) {
  (void)tz;
  struct timespec ts;
  int rc = clock_gettime(CLOCK_REALTIME, &ts);
  if (!rc) { tv->tv_sec = ts.tv_sec; tv->tv_usec = ts.tv_nsec / 1000; }
  return rc;
}
time_t time(time_t *out) {
  struct timespec ts;
  if (clock_gettime(CLOCK_REALTIME, &ts)) return (time_t)-1;
  if (out) *out = ts.tv_sec;
  return ts.tv_sec;
}
#ifdef CONTROLLER
int main(int argc, char **argv) {
  struct tm target = {0};
  if (argc != 2 || strlen(argv[1]) != 24) return 2;
  char *end = strptime(argv[1], "%Y-%m-%dT%H:%M:%S", &target);
  if (!end || strcmp(end, ".000Z")) return 3;
  time_t sec = timegm(&target);
  if (sec < 1704067200 || sec > 2208988800LL) return 4;
  struct timespec real;
  if (syscall(SYS_clock_gettime, CLOCK_REALTIME, &real)) return 5;
  int64_t delta = (int64_t)sec * 1000000000LL - ((int64_t)real.tv_sec * 1000000000LL + real.tv_nsec);
  char tmp[256], buf[64];
  snprintf(tmp, sizeof(tmp), "%s.%ld", FILEPATH, (long)getpid());
  int fd = open(tmp, O_WRONLY | O_CREAT | O_EXCL, 0600);
  if (fd < 0) return 6;
  int n = snprintf(buf, sizeof(buf), "%lld\n", (long long)delta);
  if (write(fd, buf, n) != n || fsync(fd) || close(fd) || rename(tmp, FILEPATH)) return 7;
  return 0;
}
#endif