import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class JavaCommunicationsTest {
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final Pattern JOB_ID = Pattern.compile("\\\"jobId\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    private static String post(String url, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200 && response.statusCode() != 202) {
            throw new IllegalStateException("HTTP " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    public static void main(String[] args) throws Exception {
        String baseUrl = args.length == 0 ? "http://127.0.0.1:4777" : args[0];
        String request = "{\"mapperId\":\"communications-normalize\",\"sourceType\":\"swift-mt103\",\"targetType\":\"pacs\",\"payload\":{\"reference\":\"COMM-JAVA-SYNC\",\"amount\":\"100,25\",\"currency\":\"USD\"}}";
        String sync = post(baseUrl + "/map", request);
        if (!sync.contains("COMM-JAVA-SYNC") || !sync.contains("100.25")) {
            throw new IllegalStateException("sync response did not contain normalized payload: " + sync);
        }

        String queued = post(baseUrl + "/map/async", request.replace("COMM-JAVA-SYNC", "COMM-JAVA-ASYNC"));
        Matcher matcher = JOB_ID.matcher(queued);
        if (!matcher.find()) throw new IllegalStateException("async response did not contain a job ID: " + queued);
        String jobId = matcher.group(1);
        String completed = "";
        for (int attempt = 0; attempt < 40; attempt++) {
            HttpRequest poll = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/jobs/" + jobId))
                .GET()
                .build();
            completed = HTTP.send(poll, HttpResponse.BodyHandlers.ofString()).body();
            if (completed.contains("\"status\":\"completed\"")) break;
            Thread.sleep(10);
        }
        if (!completed.contains("COMM-JAVA-ASYNC") || !completed.contains("100.25")) {
            throw new IllegalStateException("async response did not complete: " + completed);
        }
        System.out.println("[java-communications] PASS: sync and async mapper calls");
    }
}
